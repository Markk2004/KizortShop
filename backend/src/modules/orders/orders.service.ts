import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

export interface CreateOrderDto {
  userId: string;
  productId: string;
  note?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Checkout an order: atomically allocates an AVAILABLE stock item,
   * creates the order record, updates stock to SOLD, and notifies Discord.
   */
  async checkout(dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { wallet: true },
    });
    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} not found`);
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        stocks: {
          where: { status: 'AVAILABLE' },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException(`Product ${dto.productId} not found or inactive`);
    }

    const price = Number(product.price);
    const balance = user.wallet ? Number(user.wallet.balance) : 0;
    if (balance < price) {
      throw new BadRequestException(
        `Insufficient balance. Balance: ฿${balance.toFixed(2)}, Required: ฿${price.toFixed(2)}`,
      );
    }

    const allocatedStock = product.stocks[0];
    if (!allocatedStock) {
      // Out of stock
      await this.discordWebhook.notifyLowStock({
        productTitle: product.title,
        code: product.code,
        remaining: 0,
        threshold: parseInt(this.config.get<string>('LOW_STOCK_THRESHOLD') || '2', 10),
      }).catch(() => {});

      throw new BadRequestException(`Product ${product.title} (${product.code}) is out of stock`);
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    // Transaction to safely update wallet, order, and stock
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct wallet
      await tx.wallet.update({
        where: { userId: user.id },
        data: {
          balance: { decrement: price },
          totalSpent: { increment: price },
        },
      });

      // 2. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          productId: product.id,
          amount: price,
          costAmount: allocatedStock.costPrice ? Number(allocatedStock.costPrice) : undefined,
          status: 'COMPLETED',
          note: dto.note,
        },
      });

      // 3. Mark stock as SOLD
      await tx.accountStock.update({
        where: { id: allocatedStock.id },
        data: {
          status: 'SOLD',
          orderId: order.id,
          soldAt: new Date(),
        },
      });

      return order;
    });

    // Count remaining available stock
    const remainingStockCount = await this.prisma.accountStock.count({
      where: { productId: product.id, status: 'AVAILABLE' },
    });

    // Notify Discord #web-orders
    await this.discordWebhook.notifyOrderCreated({
      orderNumber: result.orderNumber,
      username: user.username,
      productTitle: product.title,
      amount: price,
      stockSerial: allocatedStock.serialCode,
      remainingStockCount,
    }).catch(() => {});

    // Check low stock threshold
    const lowStockThreshold = parseInt(
      this.config.get<string>('LOW_STOCK_THRESHOLD') || '2',
      10,
    );
    if (remainingStockCount <= lowStockThreshold) {
      await this.discordWebhook.notifyLowStock({
        productTitle: product.title,
        code: product.code,
        remaining: remainingStockCount,
        threshold: lowStockThreshold,
      }).catch(() => {});
    }

    return {
      orderId: result.id,
      orderNumber: result.orderNumber,
      productTitle: product.title,
      amount: price,
      deliveredSerial: allocatedStock.serialCode,
      createdAt: result.createdAt,
    };
  }

  async listOrders(params?: { userId?: string; status?: string; limit?: number }) {
    const where: any = {};
    if (params?.userId) where.userId = params.userId;
    if (params?.status) where.status = params.status;

    return await this.prisma.order.findMany({
      where,
      take: params?.limit || 20,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { title: true, code: true } },
        user: { select: { username: true } },
      },
    });
  }

  async listRecentTickerOrders(limit = 10) {
    const [orders, soldStocks] = await Promise.all([
      this.prisma.order.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { title: true } },
          user: { select: { username: true } },
        },
      }),
      this.prisma.accountStock.findMany({
        where: { status: 'SOLD' },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { title: true, price: true } },
        },
      }),
    ]);

    const items: Array<{
      id: string;
      username: string;
      productName: string;
      amount: number;
      minutesAgo: number;
      ts: number;
    }> = [];

    for (const o of orders) {
      const rawUser = o.user?.username || 'Customer';
      const maskedUser = rawUser.length > 3 ? `${rawUser.slice(0, 3)}***` : `${rawUser}***`;
      const mins = Math.max(1, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000));
      items.push({
        id: o.id,
        username: maskedUser,
        productName: o.product?.title || 'สินค้าเกม',
        amount: Number(o.amount),
        minutesAgo: mins,
        ts: new Date(o.createdAt).getTime(),
      });
    }

    for (const s of soldStocks) {
      const rawUser = s.username || s.maskedIdentity || 'Player';
      const maskedUser = rawUser.includes('***')
        ? rawUser
        : rawUser.length > 4
          ? `${rawUser.slice(0, 4)}***`
          : `${rawUser}***`;
      let price = 0;
      if (s.sellingPriceText) {
        const parsed = parseFloat(s.sellingPriceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) price = parsed;
      }
      if (price === 0 && s.product?.price) {
        price = Number(s.product.price);
      }
      const soldDate = s.soldAt || s.updatedAt || s.createdAt;
      const mins = Math.max(1, Math.floor((Date.now() - new Date(soldDate).getTime()) / 60000));
      items.push({
        id: s.id,
        username: maskedUser,
        productName: s.details || s.farmedMaps || s.product?.title || 'ไก่ตัน Break And Steal Egg',
        amount: price || 150,
        minutesAgo: mins,
        ts: new Date(soldDate).getTime(),
      });
    }

    items.sort((a, b) => b.ts - a.ts);
    return items.slice(0, limit).map(({ ts, ...rest }) => rest);
  }

  async getPublicProducts(categorySlug?: string) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        code: { not: 'KAITUN-VAULT-POOL' },
      },
      include: {
        category: true,
        stocks: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = products.map((p) => {
      const stock = p.stocks.filter((s) => s.status === 'AVAILABLE').length;
      return {
        id: p.id,
        code: p.code,
        categoryId: p.category?.slug || p.categoryId,
        title: p.title,
        subtitle: p.description || p.category?.name || 'ทั่วไป',
        image: p.image || '/assets/blox_fruits_category.jpg',
        tags: [p.category?.name || 'ทั่วไป', `SKU: ${p.code}`],
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
        stock,
        badge: p.badge || undefined,
        status: p.isActive && stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
      };
    });

    if (categorySlug) {
      return mapped.filter(
        (p) =>
          p.categoryId === categorySlug ||
          p.tags.some((t) => t.toLowerCase().includes(categorySlug.toLowerCase())),
      );
    }
    return mapped;
  }

  async getPublicStoreStats() {
    const [usersCount, categoriesCount, availStockCount, soldStockCount, ordersCount] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.category.count({ where: { isActive: true } }),
        this.prisma.accountStock.count({ where: { status: 'AVAILABLE' } }),
        this.prisma.accountStock.count({ where: { status: 'SOLD' } }),
        this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      ]);

    return [
      {
        id: 'users',
        label: 'สมาชิกลงทะเบียน',
        value: `${usersCount.toLocaleString()}`,
        note: 'ซิงค์สดจาก Supabase',
        noteTone: 'positive',
      },
      {
        id: 'categories',
        label: 'หมวดหมู่สินค้า',
        value: `${categoriesCount.toLocaleString()}`,
        note: 'ครอบคลุมทุกแมพยอดนิยม',
      },
      {
        id: 'stock',
        label: 'สต็อกพร้อมจัดส่ง',
        value: `${availStockCount.toLocaleString()}`,
        note: 'ระบบจัดส่งอัตโนมัติ 24 ชม.',
        noteTone: 'positive',
      },
      {
        id: 'orders',
        label: 'คำสั่งซื้อสำเร็จ',
        value: `${(soldStockCount + ordersCount).toLocaleString()}`,
        note: 'การันตีความปลอดภัย 100%',
      },
    ];
  }

  getPublicReviews() {
    return [
      {
        id: 'r1',
        username: 'saka***',
        productName: 'ไก่ตันที่ขุด Break And Steal Egg',
        rating: 5,
        comment: 'ระบบส่งไวมากครับ ได้ของครบตามที่เขียนไว้ในรายละเอียด การันตีความปลอดภัย',
      },
      {
        id: 'r2',
        username: 'karo***',
        productName: 'ไก่ตันที่ขุด Break And Steal Egg',
        rating: 5,
        comment: 'สแกนเติมเงินผ่าน QR ไวมาก หักเงินแล้วของเด้งในหน้าประวัติทันที บริการประทับใจ',
      },
      {
        id: 'r3',
        username: 'anak***',
        productName: 'ตัว 1 in 880 บัพตัน',
        rating: 5,
        comment: 'เข้าเล่นได้ปกติทุกไอดี สะอาด ปลอดภัย ไม่มีดึงกลับอย่างแน่นอน แนะนำร้านนี้ครับ',
      },
    ];
  }
}
