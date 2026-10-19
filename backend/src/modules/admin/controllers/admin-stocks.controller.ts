import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AddStockBatchDto, StockStatus, UpdateStockStatusDto } from "../dto/admin-product.dto";
import {
  decryptCredentialAes256Gcm,
  encryptCredentialAes256Gcm,
  inspectAndHashCredential,
  CredentialFormat,
} from "../../../common/crypto/stock-crypto.util";

interface StockRecord {
  id: string;
  serialCode: string;
  productId: string;
  productCode: string;
  credentialFormat: CredentialFormat;
  credentialHash: string;
  maskedIdentity: string;
  encryptedCredentials: string;
  batchCode: string;
  supplierName: string;
  costPrice: number;
  defectReason?: string;
  status: StockStatus;
  importedAt: string;
  orderNumber?: string;
}

// In-memory mock store for demo & test runtime (backed by Prisma in production)
const vaultStore: StockRecord[] = [
  {
    id: "stk_01",
    serialCode: "STK-BFV4-261018-0001",
    productId: "prod_01",
    productCode: "BF-V4-MAX-01",
    credentialFormat: "USER_PASS",
    credentialHash: inspectAndHashCredential("bf_cyborg99:P@ssword2026", "USER_PASS").credentialHash,
    maskedIdentity: "bf_c***",
    encryptedCredentials: encryptCredentialAes256Gcm("bf_cyborg99:P@ssword2026", "secret-2026"),
    batchCode: "LOT-261018-A",
    supplierName: "KaitanFarm_TH",
    costPrice: 190,
    status: "AVAILABLE",
    importedAt: "2026-10-18 11:20",
  },
  {
    id: "stk_02",
    serialCode: "STK-UNQKIT-261017-0006",
    productId: "prod_04",
    productCode: "UNQ-KITSUNE-04",
    credentialFormat: "USER_PASS_2FA",
    credentialHash: inspectAndHashCredential("kitsune_lord01:FoxFire@999:BACKUP-8821", "USER_PASS_2FA").credentialHash,
    maskedIdentity: "kits***",
    encryptedCredentials: encryptCredentialAes256Gcm("kitsune_lord01:FoxFire@999:BACKUP-8821", "secret-2026"),
    batchCode: "LOT-261017-VIP",
    supplierName: "Vanguard_Collector",
    costPrice: 620,
    status: "AVAILABLE",
    importedAt: "2026-10-17 22:15",
  },
];

@Controller("admin/stocks")
export class AdminStocksController {
  @Get()
  async listStocks(
    @Query("page") page: string = "1",
    @Query("pageSize") pageSize: string = "5",
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.max(1, parseInt(pageSize, 10) || 5);

    let filtered = [...vaultStore];
    if (status && status !== "ALL") {
      filtered = filtered.filter((s) => s.status === status);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.serialCode.toLowerCase().includes(q) ||
          s.productCode.toLowerCase().includes(q) ||
          s.batchCode.toLowerCase().includes(q) ||
          s.supplierName.toLowerCase().includes(q) ||
          s.maskedIdentity.toLowerCase().includes(q),
      );
    }

    const total = filtered.length;
    const startIndex = (p - 1) * size;
    const data = filtered.slice(startIndex, startIndex + size).map((s) => ({
      id: s.id,
      serialCode: s.serialCode,
      productId: s.productId,
      productCode: s.productCode,
      credentialFormat: s.credentialFormat,
      credentialHash: s.credentialHash,
      maskedIdentity: s.maskedIdentity,
      batchCode: s.batchCode,
      supplierName: s.supplierName,
      costPrice: s.costPrice,
      status: s.status,
      defectReason: s.defectReason,
      importedAt: s.importedAt,
      orderNumber: s.orderNumber,
    }));

    return {
      message: "Stock vault items retrieved",
      data,
      pagination: {
        currentPage: p,
        pageSize: size,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
      counts: {
        available: vaultStore.filter((s) => s.status === "AVAILABLE").length,
        sold: vaultStore.filter((s) => s.status === "SOLD").length,
        claimed: vaultStore.filter((s) => s.status === "CLAIMED_DEFECTIVE").length,
        total: vaultStore.length,
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

    const errors: string[] = [];
    const expectedFormat: CredentialFormat =
      dto.productCode && dto.productCode.startsWith("UNQ-") ? "USER_PASS_2FA" : "USER_PASS";

    const preparedRecords: StockRecord[] = [];
    const nowStr = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    dto.credentials.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const inspection = inspectAndHashCredential(rawLine, expectedFormat);
      if (!inspection.isValid) {
        errors.push(`บรรทัดที่ ${lineNum}: ${inspection.error}`);
        return;
      }

      // Check duplicate hash against in-memory vault
      const existing = vaultStore.find((s) => s.credentialHash === inspection.credentialHash);
      if (existing && !dto.allowRestockOverride) {
        errors.push(
          `บรรทัดที่ ${lineNum}: ตรวจพบรหัสซ้ำระดับ Global Hash (${inspection.credentialHash.slice(
            0,
            12,
          )}) กับสต็อก ${existing.serialCode} [สถานะ: ${existing.status}]`,
        );
        return;
      }

      const seqNum = String(vaultStore.length + preparedRecords.length + 1).padStart(4, "0");
      const skuTag = (dto.productCode || "SKU").replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase();

      preparedRecords.push({
        id: `stk_${Date.now()}_${idx}`,
        serialCode: `STK-${skuTag}-261018-${seqNum}`,
        productId: dto.productId,
        productCode: dto.productCode || "SKU-PROD",
        credentialFormat: expectedFormat,
        credentialHash: inspection.credentialHash,
        maskedIdentity: inspection.maskedIdentity,
        encryptedCredentials: encryptCredentialAes256Gcm(rawLine, "secret-2026"),
        batchCode: dto.batchCode || "LOT-DEFAULT",
        supplierName: dto.supplierName || "Direct_Import",
        costPrice: dto.costPrice || 0,
        status: "AVAILABLE",
        importedAt: nowStr,
      });
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: "Failed credential validation or duplicate detected",
        errors,
      });
    }

    vaultStore.unshift(...preparedRecords);

    return {
      message: `Successfully validated & stored ${preparedRecords.length} accounts into AES-256 Vault`,
      importedCount: preparedRecords.length,
      serials: preparedRecords.map((r) => r.serialCode),
    };
  }

  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Body() dto: UpdateStockStatusDto) {
    const item = vaultStore.find((s) => s.id === id || s.serialCode === id);
    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    item.status = dto.status;
    if (dto.defectReason) {
      item.defectReason = dto.defectReason;
    }
    if (dto.orderNumber) {
      item.orderNumber = dto.orderNumber;
    }

    return {
      message: `Stock ${item.serialCode} updated to ${item.status}`,
      data: item,
    };
  }

  @Post(":id/reveal")
  async revealCredential(@Param("id") id: string) {
    const item = vaultStore.find((s) => s.id === id || s.serialCode === id);
    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    const decrypted = decryptCredentialAes256Gcm(item.encryptedCredentials, "secret-2026");
    return {
      message: "Credential decrypted successfully for audit",
      serialCode: item.serialCode,
      decrypted,
    };
  }
}
