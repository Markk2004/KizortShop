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
}
