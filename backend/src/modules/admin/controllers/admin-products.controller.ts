import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { DiscordWebhookService } from "../../../common/webhook/discord-webhook.service";
import {
  CreateAdminProductDto,
  UpdateAdminProductDto,
  UpdateRobuxStatusDto,
} from "../dto/admin-product.dto";
import {
  encryptCredentialAes256Gcm,
  inspectAndHashCredential,
} from "../../../common/crypto/stock-crypto.util";

// In-memory service state for Robux auto-topup (defaults to OUT_OF_STOCK as requested)
let robuxServiceState = {
  serviceId: "robux-auto-topup",
  serviceName: "เติม Robux อัตโนมัติ 24 ชม.",
  status: "OUT_OF_STOCK" as "AVAILABLE" | "OUT_OF_STOCK",
  stockCount: 0,
  reason: "ระบบปรับปรุงชั่วคราว สินค้าหมดชั่วคราว",
  lastUpdatedAt: new Date().toISOString(),
};

@Controller("admin/products")
export class AdminProductsController {
  private readonly encryptionSecret =
    process.env.STOCK_ENCRYPTION_SECRET || "kz_store_aes256_gcm_stock_vault_secret_2026";

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  private async importProductCredentials(
    product: { id: string; code: string; title: string; price: any; category?: { name: string } | null },
    credentials?: string[],
    credentialFormat: string = "USER_PASS",
  ): Promise<{ importedCount: number; usernames: string[] }> {
    let importedCount = 0;
    const usernames: string[] = [];

    if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
      return { importedCount, usernames };
    }

    const validLines = credentials
      .map((l) => (typeof l === "string" ? l.trim() : ""))
      .filter((l) => l.length > 0);
    const uniqueLines = Array.from(new Set(validLines));

    for (let i = 0; i < uniqueLines.length; i++) {
      const rawLine = uniqueLines[i];
      const inspection = inspectAndHashCredential(rawLine, credentialFormat as any);
      if (!inspection.isValid) continue;

      const rawParts = rawLine.includes("|")
        ? rawLine.split("|").map((s) => s.trim())
        : rawLine.split(":").map((s) => s.trim());
      const rawUsername = rawParts[0] || inspection.normalizedPrimaryKey;
      const normalizedCipherSource = rawParts.length >= 2 ? `${rawParts[0]}:${rawParts[1]}` : rawLine;

      const skuTag = product.code.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase();
      const serialCode = `STK-${skuTag}-${Date.now().toString().slice(-6)}-${(i + 1)
        .toString()
        .padStart(3, "0")}`;

      const encrypted = encryptCredentialAes256Gcm(normalizedCipherSource, this.encryptionSecret);

      try {
        await this.prisma.accountStock.upsert({
          where: { credentialHash: inspection.credentialHash },
          update: {
            productId: product.id,
            credentialFormat: credentialFormat as any,
            maskedIdentity: inspection.maskedIdentity,
            credentials: encrypted,
            username: rawUsername,
            farmedMaps: product.category?.name || "",
            details: product.title,
            sellingPriceText: `${Number(product.price)} บาท`,
            status: "AVAILABLE",
          },
          create: {
            serialCode,
            productId: product.id,
            credentialFormat: credentialFormat as any,
            credentialHash: inspection.credentialHash,
            maskedIdentity: inspection.maskedIdentity,
            credentials: encrypted,
            username: rawUsername,
            farmedMaps: product.category?.name || "",
            details: product.title,
            sellingPriceText: `${Number(product.price)} บาท`,
            batchCode: `BATCH-${Date.now().toString().slice(-6)}`,
            supplierName: "Admin Web Import",
            addedSource: "WEB",
            status: "AVAILABLE",
          },
        });
        importedCount++;
        usernames.push(rawUsername);
      } catch {
        // ignore error in batch
      }
    }

    return { importedCount, usernames };
  }

  @Get()
  async listAllProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        stocks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = products.map((p) => {
      const availStock = p.stocks.filter((s) => s.status === "AVAILABLE").length;
      const soldStock = p.stocks.filter((s) => s.status === "SOLD").length;
      const stock = availStock;
      const status = p.isActive && stock > 0 ? "AVAILABLE" : "OUT_OF_STOCK";

      return {
        id: p.id,
        code: p.code,
        title: p.title,
        description: p.description || "",
        category: p.category ? p.category.name : "ทั่วไป",
        categoryId: p.categoryId,
        categorySlug: p.category ? p.category.slug : "",
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
        stock,
        status: status as "AVAILABLE" | "OUT_OF_STOCK",
        sold: soldStock,
        badge: p.badge || undefined,
        image: p.image,
        createdAt: p.createdAt,
      };
    });

    return {
      message: "Admin full product inventory list",
      data,
    };
  }

  /**
   * Diagnostic check function: checkRobuxAvailability
   */
  @Get("robux/status")
  async checkRobuxAvailability() {
    const isAvailable =
      robuxServiceState.status === "AVAILABLE" && robuxServiceState.stockCount > 0;
    return {
      serviceId: robuxServiceState.serviceId,
      serviceName: robuxServiceState.serviceName,
      isAvailable,
      status: robuxServiceState.status,
      statusLabel: isAvailable ? "มีสินค้า" : "สินค้าหมดชั่วคราว",
      stockCount: robuxServiceState.stockCount,
      message: isAvailable
        ? "บริการเติม Robux อัตโนมัติเปิดให้บริการตามปกติ ส่งมอบทันที 24 ชม."
        : robuxServiceState.reason,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Admin updates Robux auto-topup availability: AVAILABLE vs OUT_OF_STOCK
   */
  @Patch("robux/status")
  async updateRobuxStatus(@Body() dto: UpdateRobuxStatusDto) {
    robuxServiceState = {
      ...robuxServiceState,
      status: dto.status,
      stockCount:
        dto.stockCount !== undefined
          ? dto.stockCount
          : dto.status === "AVAILABLE"
          ? 10000
          : 0,
      reason:
        dto.reason ||
        (dto.status === "OUT_OF_STOCK"
          ? "สินค้าหมดชั่วคราว ปิดการเติม Robux อัตโนมัติ"
          : ""),
      lastUpdatedAt: new Date().toISOString(),
    };

    return {
      message: `Robux status successfully updated to ${dto.status}`,
      data: robuxServiceState,
    };
  }

  @Post()
  async createProduct(@Body() dto: CreateAdminProductDto) {
    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException("ชื่อสินค้าเป็นข้อมูลจำเป็น");
    }

    // Resolve Category
    let category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { id: dto.categoryId },
          { slug: dto.categoryId },
          { name: dto.categoryId },
        ],
      },
    });

    if (!category) {
      category = await this.prisma.category.findFirst();
      if (!category) {
        category = await this.prisma.category.create({
          data: {
            slug: "general",
            name: "ทั่วไป",
            description: "หมวดหมู่ทั่วไป",
            image: "/assets/blox_fruits_category.jpg",
          },
        });
      }
    }

    // Generate or format SKU
    const rawCode =
      dto.code?.trim() ||
      `${category.slug.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const code = rawCode.toUpperCase();

    // Check code collision
    const existingProduct = await this.prisma.product.findUnique({
      where: { code },
    });
    const finalCode = existingProduct ? `${code}-${Date.now().toString().slice(-3)}` : code;

    const product = await this.prisma.product.create({
      data: {
        code: finalCode,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        categoryId: category.id,
        price: dto.price || 0,
        originalPrice: dto.originalPrice || null,
        badge: dto.badge || null,
        image: dto.image || "/assets/blox_fruits_category.jpg",
        stockMode: (dto.stockMode as any) || "POOL",
        credentialFormat: (dto.credentialFormat as any) || "USER_PASS",
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    const { importedCount, usernames } = await this.importProductCredentials(
      product,
      dto.credentials,
      dto.credentialFormat || "USER_PASS",
    );

    const stock = importedCount;
    const status = stock > 0 ? "AVAILABLE" : "OUT_OF_STOCK";

    await this.discordWebhook.notifyCatalogAction({
      type: "PRODUCT",
      action: "CREATED",
      name: product.title,
      code: product.code,
      categoryName: product.category.name,
      price: Number(product.price),
      stock,
      status,
    });

    if (importedCount > 0) {
      await this.discordWebhook.notifyStockImport({
        count: importedCount,
        productTitle: product.title,
        batchCode: `INIT-${product.code}`,
        supplierName: "Admin Product Creation",
        usernames,
      });
    }

    return {
      message: `สร้างสินค้า ${product.code} สำเร็จ`,
      data: {
        id: product.id,
        code: product.code,
        title: product.title,
        description: product.description || "",
        category: product.category.name,
        categoryId: product.categoryId,
        categorySlug: product.category.slug,
        price: Number(product.price),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
        stock,
        status: status as "AVAILABLE" | "OUT_OF_STOCK",
        sold: 0,
        badge: product.badge || undefined,
        image: product.image,
      },
    };
  }

  @Patch(":id")
  async updateProduct(@Param("id") id: string, @Body() dto: UpdateAdminProductDto) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: { category: true, stocks: true },
    });

    if (!product) {
      throw new NotFoundException("ไม่พบสินค้าที่ต้องการแก้ไข");
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.code !== undefined && dto.code.trim()) updateData.code = dto.code.trim().toUpperCase();
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.originalPrice !== undefined) updateData.originalPrice = dto.originalPrice;
    if (dto.badge !== undefined) updateData.badge = dto.badge;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.status !== undefined) {
      updateData.isActive = dto.status === "AVAILABLE";
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          OR: [
            { id: dto.categoryId },
            { slug: dto.categoryId },
            { name: dto.categoryId },
          ],
        },
      });
      if (category) {
        updateData.categoryId = category.id;
      }
    }

    let updated = await this.prisma.product.update({
      where: { id: product.id },
      data: updateData,
      include: { category: true, stocks: true },
    });

    // If new stock credentials were provided during edit, import them
    if (dto.credentials && dto.credentials.length > 0) {
      const { importedCount, usernames } = await this.importProductCredentials(
        updated,
        dto.credentials,
        updated.credentialFormat,
      );
      if (importedCount > 0) {
        await this.discordWebhook.notifyStockImport({
          count: importedCount,
          productTitle: updated.title,
          batchCode: `EDIT-${updated.code}`,
          supplierName: "Admin Product Edit",
          usernames,
        });
        updated = (await this.prisma.product.findUnique({
          where: { id: product.id },
          include: { category: true, stocks: true },
        }))!;
      }
    }

    const availStock = updated.stocks.filter((s) => s.status === "AVAILABLE").length;
    const stock = availStock;
    const status = updated.isActive && stock > 0 ? "AVAILABLE" : "OUT_OF_STOCK";

    await this.discordWebhook.notifyCatalogAction({
      type: "PRODUCT",
      action: dto.status !== undefined && dto.title === undefined ? "STATUS_CHANGED" : "UPDATED",
      name: updated.title,
      code: updated.code,
      categoryName: updated.category.name,
      price: Number(updated.price),
      stock,
      status,
    });

    return {
      message: `แก้ไขสินค้า ${updated.code} สำเร็จ`,
      data: {
        id: updated.id,
        code: updated.code,
        title: updated.title,
        category: updated.category.name,
        categoryId: updated.categoryId,
        categorySlug: updated.category.slug,
        price: Number(updated.price),
        originalPrice: updated.originalPrice ? Number(updated.originalPrice) : undefined,
        stock,
        status: status as "AVAILABLE" | "OUT_OF_STOCK",
        sold: updated.stocks.filter((s) => s.status === "SOLD").length,
      },
    };
  }

  @Delete(":id")
  async deleteProduct(@Param("id") id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException("ไม่พบสินค้าที่ต้องการลบ");
    }

    // Delete associated account stocks first to ensure clean cascade
    await this.prisma.accountStock.deleteMany({
      where: { productId: product.id },
    });

    await this.prisma.product.delete({
      where: { id: product.id },
    });

    await this.discordWebhook.notifyCatalogAction({
      type: "PRODUCT",
      action: "DELETED",
      name: product.title,
      code: product.code,
      categoryName: product.category?.name,
    });

    return {
      message: `ลบสินค้า ${product.code} สำเร็จ`,
      data: { id: product.id },
    };
  }
}
