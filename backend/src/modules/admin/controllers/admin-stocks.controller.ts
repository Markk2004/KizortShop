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
  Put,
  Query,
} from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { DiscordWebhookService } from "../../../common/webhook/discord-webhook.service";
import {
  AddStockBatchDto,
  StockStatus,
  UpdateStockStatusDto,
  UpdateStockItemDto,
} from "../dto/admin-product.dto";
import {
  decryptCredentialAes256Gcm,
  encryptCredentialAes256Gcm,
  inspectAndHashCredential,
  CredentialFormat,
} from "../../../common/crypto/stock-crypto.util";

@Controller("admin/stocks")
export class AdminStocksController {
  private readonly encryptionSecret =
    process.env.STOCK_ENCRYPTION_SECRET || "kz_store_aes256_gcm_stock_vault_secret_2026";

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  @Get()
  async listStocks(
    @Query("page") page: string = "1",
    @Query("pageSize") pageSize: string = "10",
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.max(1, parseInt(pageSize, 10) || 10);

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { serialCode: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { maskedIdentity: { contains: q, mode: "insensitive" } },
        { farmedMaps: { contains: q, mode: "insensitive" } },
        { details: { contains: q, mode: "insensitive" } },
        { batchCode: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { product: { code: { contains: q, mode: "insensitive" } } },
        { product: { title: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, items, counts] = await Promise.all([
      this.prisma.accountStock.count({ where }),
      this.prisma.accountStock.findMany({
        where,
        skip: (p - 1) * size,
        take: size,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              title: true,
              price: true,
              stockMode: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
      }),
      Promise.all([
        this.prisma.accountStock.count({ where: { status: "AVAILABLE" } }),
        this.prisma.accountStock.count({ where: { status: "SOLD" } }),
        this.prisma.accountStock.count({ where: { status: "CLAIMED_DEFECTIVE" } }),
        this.prisma.accountStock.count(),
      ]),
    ]);

    const data = items.map((s) => ({
      id: s.id,
      serialCode: s.serialCode,
      productId: s.productId,
      productCode: s.product.code,
      productTitle: s.product.title,
      categoryName: s.product.category?.name || "",
      stockMode: s.product.stockMode,
      username: s.username || s.maskedIdentity,
      maskedIdentity: s.maskedIdentity,
      credentialFormat: s.credentialFormat,
      credentialHash: s.credentialHash,
      farmedMaps: s.farmedMaps || "",
      details: s.details || "",
      sellingPriceText: s.sellingPriceText || (s.product.price ? `${s.product.price} บาท` : ""),
      addedSource: s.addedSource,
      batchCode: s.batchCode,
      supplierName: s.supplierName,
      costPrice: s.costPrice ? Number(s.costPrice) : 0,
      status: s.status,
      defectReason: s.defectReason,
      importedAt: s.createdAt.toISOString(),
      orderNumber: s.order?.orderNumber,
    }));

    return {
      message: "Stock vault items retrieved from Supabase",
      data,
      pagination: {
        currentPage: p,
        pageSize: size,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
      counts: {
        available: counts[0],
        sold: counts[1],
        claimed: counts[2],
        total: counts[3],
      },
    };
  }

  @Post("batch")
  async importBatchCredentials(@Body() dto: AddStockBatchDto) {
    if (!dto.productId) {
      throw new BadRequestException("productId is required");
    }
    if (!dto.credentials || dto.credentials.length === 0) {
      throw new BadRequestException("At least 1 credential line is required");
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const errors: string[] = [];
    const expectedFormat = product.credentialFormat;
    const preparedRecords: any[] = [];

    for (let idx = 0; idx < dto.credentials.length; idx++) {
      const rawLine = dto.credentials[idx];
      const lineNum = idx + 1;
      const inspection = inspectAndHashCredential(rawLine, expectedFormat);
      if (!inspection.isValid) {
        errors.push(`บรรทัดที่ ${lineNum}: ${inspection.error}`);
        continue;
      }

      // Check duplicate hash
      const existing = await this.prisma.accountStock.findUnique({
        where: { credentialHash: inspection.credentialHash },
      });
      if (existing && !dto.allowRestockOverride) {
        errors.push(
          `บรรทัดที่ ${lineNum}: ตรวจพบรหัสซ้ำระดับ Global Hash กับสต็อก ${existing.serialCode} [สถานะ: ${existing.status}]`,
        );
        continue;
      }

      const rawParts = rawLine.includes("|")
        ? rawLine.split("|").map((s) => s.trim())
        : rawLine.split(":").map((s) => s.trim());
      const rawUsername = rawParts[0]?.trim();
      const normalizedPlain =
        rawParts.length >= 2 ? `${rawParts[0]}:${rawParts.slice(1).join(":")}` : rawLine.trim();
      const seqNum = String(Date.now() + idx).slice(-6);
      const skuTag = product.code.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase();

      preparedRecords.push({
        serialCode: `STK-${skuTag}-${seqNum}`,
        productId: dto.productId,
        credentialFormat: expectedFormat,
        credentialHash: inspection.credentialHash,
        maskedIdentity: inspection.maskedIdentity,
        credentials: encryptCredentialAes256Gcm(normalizedPlain, this.encryptionSecret),
        username: rawUsername,
        farmedMaps: product.category?.name || "",
        details: product.title,
        sellingPriceText: product.price ? `${Number(product.price)} บาท` : "",
        batchCode: dto.batchCode || "LOT-DEFAULT",
        supplierName: dto.supplierName || "ทำเอง (Self-Farmed)",
        costPrice: dto.costPrice || 0,
        addedSource: "WEB",
        status: "AVAILABLE",
      });
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: "Failed credential validation or duplicate detected",
        errors,
      });
    }

    // Insert into Supabase
    for (const record of preparedRecords) {
      await this.prisma.accountStock.upsert({
        where: { credentialHash: record.credentialHash },
        update: record,
        create: record,
      });
    }

    // Write AuditLog for stock addition with metadata (no plain credentials)
    await this.prisma.auditLog.create({
      data: {
        action: "STOCK_IMPORT",
        targetType: "STOCK",
        targetId: product.id,
        metadata: {
          productCode: product.code,
          productTitle: product.title,
          count: preparedRecords.length,
          batchCode: dto.batchCode,
          supplierName: dto.supplierName,
          serials: preparedRecords.map((r) => r.serialCode),
        },
      },
    }).catch(() => {});

    // Notify Discord #web-stock-logs and #kaitun-id
    await this.discordWebhook.notifyStockImport({
      count: preparedRecords.length,
      productTitle: product.title,
      batchCode: dto.batchCode,
      supplierName: dto.supplierName,
      usernames: preparedRecords.map((r) => r.username).filter(Boolean),
    });

    return {
      message: `Successfully validated & stored ${preparedRecords.length} accounts into Supabase Vault`,
      importedCount: preparedRecords.length,
      serials: preparedRecords.map((r) => r.serialCode),
    };
  }

  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Body() dto: UpdateStockStatusDto) {
    const item = await this.prisma.accountStock.findFirst({
      where: { OR: [{ id }, { serialCode: id }] },
      include: { product: true },
    });
    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    const updated = await this.prisma.accountStock.update({
      where: { id: item.id },
      data: {
        status: dto.status,
        defectReason: dto.defectReason || item.defectReason,
        soldAt: dto.status === "SOLD" ? new Date() : null,
      },
    });

    // 2-Way Sync Notification to Discord #kaitun-id
    if (item.username) {
      await this.discordWebhook.notifyKaitunSync(dto.status === "SOLD" ? "SOLD" : "AVAILABLE", {
        username: item.username,
        details: item.details || "",
        farmedMaps: item.farmedMaps || "",
        price: item.sellingPriceText || (item.product ? `${item.product.price} บาท` : ""),
        actor: "Admin Web Panel",
      });
    }

    return {
      message: `Stock ${item.serialCode} updated to ${updated.status}`,
      data: updated,
    };
  }

  @Put(":id/details")
  async updateDetails(@Param("id") id: string, @Body() dto: UpdateStockItemDto) {
    const item = await this.prisma.accountStock.findFirst({
      where: { OR: [{ id }, { serialCode: id }] },
      include: { product: true },
    });
    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    const dataToUpdate: any = {};
    let passwordChanged = false;

    if (dto.password && dto.password.trim()) {
      const u = item.username || item.maskedIdentity;
      const newRaw = `${u}:${dto.password.trim()}`;
      dataToUpdate.credentials = encryptCredentialAes256Gcm(newRaw, this.encryptionSecret);
      passwordChanged = true;
    }
    if (dto.farmedMaps !== undefined) dataToUpdate.farmedMaps = dto.farmedMaps;
    if (dto.details !== undefined) dataToUpdate.details = dto.details;
    if (dto.sellingPriceText !== undefined) dataToUpdate.sellingPriceText = dto.sellingPriceText;
    if (dto.status !== undefined) {
      dataToUpdate.status = dto.status;
      if (dto.status === "SOLD") dataToUpdate.soldAt = new Date();
    }
    if (dto.productId) dataToUpdate.productId = dto.productId;
    if (dto.defectReason !== undefined) dataToUpdate.defectReason = dto.defectReason;

    const updated = await this.prisma.accountStock.update({
      where: { id: item.id },
      data: dataToUpdate,
      include: { product: true },
    });

    // 2-Way Sync Notification to Discord #kaitun-id
    if (updated.username) {
      const actionType = passwordChanged
        ? "PASSWORD_UPDATED"
        : updated.status === "SOLD"
        ? "SOLD"
        : "DETAILS_UPDATED";

      await this.discordWebhook.notifyKaitunSync(actionType, {
        username: updated.username,
        details: updated.details || "",
        farmedMaps: updated.farmedMaps || "",
        price: updated.sellingPriceText || (updated.product ? `${updated.product.price} บาท` : ""),
        actor: "Admin Web Panel",
      });
    }

    return {
      message: `Stock ${item.serialCode} details updated successfully`,
      data: updated,
    };
  }

  @Post(":id/reveal")
  async revealCredential(@Param("id") id: string) {
    const item = await this.prisma.accountStock.findFirst({
      where: { OR: [{ id }, { serialCode: id }] },
      include: { product: true },
    });
    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    let decrypted = "";
    try {
      decrypted = decryptCredentialAes256Gcm(item.credentials, this.encryptionSecret);
    } catch {
      decrypted = item.credentials;
    }

    // Record Security AuditLog in Supabase
    await this.prisma.auditLog.create({
      data: {
        action: "REVEAL_STOCK_CREDENTIAL",
        targetType: "STOCK",
        targetId: item.id,
        metadata: {
          serialCode: item.serialCode,
          username: item.username,
        },
      },
    });

    // Notify Discord #web-tickets-audit
    await this.discordWebhook.notifySecurityAudit({
      action: "มีการเปิดดูรหัสผ่านจริง (Reveal Credential)",
      actor: "Web Admin",
      target: `Serial: ${item.serialCode} (${item.username || item.maskedIdentity})`,
    });

    return {
      message: "Credential decrypted successfully for audit",
      serialCode: item.serialCode,
      decrypted,
    };
  }

  @Delete(":id")
  async deleteStock(@Param("id") id: string) {
    const item = await this.prisma.accountStock.findFirst({
      where: { OR: [{ id }, { serialCode: id }] },
      include: { product: true },
    });
    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    await this.prisma.accountStock.delete({
      where: { id: item.id },
    });

    // Write AuditLog
    await this.prisma.auditLog.create({
      data: {
        action: "STOCK_DELETE",
        targetType: "STOCK",
        targetId: item.id,
        metadata: {
          serialCode: item.serialCode,
          productId: item.productId,
          username: item.username || item.maskedIdentity,
        },
      },
    }).catch(() => {});

    await this.discordWebhook.notifyStockRemoved({
      serialCode: item.serialCode,
      username: item.username || item.maskedIdentity,
      productTitle: item.product?.title,
    });

    // Check remaining available stock for low-stock notification
    const remaining = await this.prisma.accountStock.count({
      where: { productId: item.productId, status: "AVAILABLE" },
    });
    const threshold = parseInt(process.env.LOW_STOCK_THRESHOLD || "2", 10);
    if (remaining <= threshold && item.product) {
      await this.discordWebhook.notifyLowStock({
        productTitle: item.product.title,
        code: item.product.code,
        remaining,
        threshold,
      }).catch(() => {});
    }

    return {
      message: `Stock item ${item.serialCode} deleted successfully`,
      data: { id: item.id },
    };
  }
}
