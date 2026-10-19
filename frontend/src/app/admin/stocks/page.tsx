"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AdminPagination } from "@/features/admin/components/AdminPagination";
import {
  AdminSmartFilterBar,
  verifySearchInput,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";

type StockMode = "POOL" | "UNIQUE_1TO1";
type CredentialFormat = "USER_PASS" | "USER_PASS_2FA" | "COOKIE_TOKEN" | "REDEEM_KEY";
type StockStatus = "AVAILABLE" | "SOLD" | "CLAIMED_DEFECTIVE";

interface TargetProductOption {
  id: string;
  code: string;
  title: string;
  stockMode: StockMode;
  credentialFormat: CredentialFormat;
  defaultCost: number;
}

interface StockItem {
  id: string;
  serialCode: string;
  productId: string;
  productCode: string;
  productTitle: string;
  stockMode: StockMode;
  credentialFormat: CredentialFormat;
  credentialHash: string;
  maskedIdentity: string;
  credentials: string;
  batchCode: string;
  supplierName: string;
  costPrice: number;
  defectReason?: string;
  status: StockStatus;
  importedAt: string;
  orderNumber?: string;
}

/**
 * Deterministic client-side fingerprint simulating backend HMAC-SHA256
 * over normalized primary identity (username or redeem key).
 */
function computeCredentialHash(rawLine: string, format: CredentialFormat): {
  hash: string;
  maskedIdentity: string;
  primaryKey: string;
} {
  const parts = rawLine.trim().split(":");
  const primaryKey =
    format === "COOKIE_TOKEN" || format === "REDEEM_KEY"
      ? rawLine.trim().toLowerCase()
      : (parts[0] || "").trim().toLowerCase();

  let h1 = 0xdeadbeef ^ primaryKey.length;
  let h2 = 0x41c6ce57 ^ primaryKey.length;
  for (let i = 0; i < primaryKey.length; i++) {
    const ch = primaryKey.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex =
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0");

  const rawId = parts[0]?.trim() || rawLine.trim();
  const maskedIdentity =
    rawId.length <= 5 ? `${rawId.slice(0, 2)}***` : `${rawId.slice(0, 5)}***`;

  return {
    hash: `sha256_${hex}`,
    maskedIdentity,
    primaryKey,
  };
}

function validateCredentialFormat(
  rawLine: string,
  format: CredentialFormat,
): { valid: boolean; reason?: string } {
  const trimmed = rawLine.trim();
  const parts = trimmed.split(":");

  if (format === "USER_PASS") {
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      return {
        valid: false,
        reason: "ต้องอยู่ในรูปแบบ USER:PASS (คั่นด้วย : อย่างน้อย 2 ส่วน)",
      };
    }
    return { valid: true };
  }

  if (format === "USER_PASS_2FA") {
    if (parts.length < 3 || !parts[0].trim() || !parts[1].trim() || !parts[2].trim()) {
      return {
        valid: false,
        reason: "ต้องอยู่ในรูปแบบ USER:PASS:2FA_OR_EMAIL (ครบ 3 ส่วน)",
      };
    }
    return { valid: true };
  }

  if (format === "COOKIE_TOKEN") {
    if (trimmed.length < 10) {
      return {
        valid: false,
        reason: "Cookie / Token สั้นเกินไป (ต้องยาวอย่างน้อย 10 ตัวอักษร)",
      };
    }
    return { valid: true };
  }

  if (format === "REDEEM_KEY") {
    if (trimmed.length < 6 || trimmed.includes(" ")) {
      return {
        valid: false,
        reason: "Redeem Key ต้องไม่มีช่องว่างและยาวอย่างน้อย 6 ตัวอักษร",
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

const targetProductOptions: TargetProductOption[] = [
  {
    id: "prod_01",
    code: "BF-V4-MAX-01",
    title: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น",
    stockMode: "POOL",
    credentialFormat: "USER_PASS",
    defaultCost: 190,
  },
  {
    id: "prod_02",
    code: "BF-CDK-MAX-02",
    title: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ",
    stockMode: "POOL",
    credentialFormat: "USER_PASS",
    defaultCost: 110,
  },
  {
    id: "prod_04",
    code: "UNQ-KITSUNE-04",
    title: "[คัดเฉพาะ 1:1] ไอดีผลจิ้งจอกเก้าหาง Kitsune ถาวร + Sanguine Art",
    stockMode: "UNIQUE_1TO1",
    credentialFormat: "USER_PASS_2FA",
    defaultCost: 620,
  },
  {
    id: "prod_05",
    code: "BF-SHARK-05",
    title: "ไก่ตัน Blox Fruits หมัด Godhuman + สมอ Shark Anchor การันตี",
    stockMode: "POOL",
    credentialFormat: "USER_PASS",
    defaultCost: 145,
  },
  {
    id: "prod_03",
    code: "UNQ-AD-MYTHIC-03",
    title: "[คัดเฉพาะ 1:1] Anime Defenders Unit Mythic ลิมิเต็ด ดาวเต็ม",
    stockMode: "UNIQUE_1TO1",
    credentialFormat: "USER_PASS_2FA",
    defaultCost: 480,
  },
  {
    id: "prod_06",
    code: "BF-RND-06",
    title: "กล่องสุ่มไก่ตัน 6 หมัด เลเวลตัน 2550 ลุ้นดาบคู่โอเด้ง",
    stockMode: "POOL",
    credentialFormat: "USER_PASS",
    defaultCost: 45,
  },
  {
    id: "p-rbx-500",
    code: "RBX-500",
    title: "เติม Robux 500 R$ ระบบคีย์อัตโนมัติ ส่งเข้าคลังทันที",
    stockMode: "POOL",
    credentialFormat: "REDEEM_KEY",
    defaultCost: 95,
  },
];

const rawInitialSeed: Array<{
  serialCode: string;
  productId: string;
  credentials: string;
  batchCode: string;
  supplierName: string;
  costPrice: number;
  status: StockStatus;
  importedAt: string;
  orderNumber?: string;
  defectReason?: string;
}> = [
  {
    serialCode: "STK-BFV4-261018-0001",
    productId: "prod_01",
    credentials: "bf_cyborg99:P@ssword2026",
    batchCode: "LOT-261018-A",
    supplierName: "KaitanFarm_TH",
    costPrice: 190,
    status: "AVAILABLE",
    importedAt: "2026-10-18 11:20",
  },
  {
    serialCode: "STK-BFV4-261018-0002",
    productId: "prod_01",
    credentials: "bf_master_god:SafeSecret!77",
    batchCode: "LOT-261018-A",
    supplierName: "KaitanFarm_TH",
    costPrice: 190,
    status: "AVAILABLE",
    importedAt: "2026-10-18 11:25",
  },
  {
    serialCode: "STK-BFCDK-261018-0003",
    productId: "prod_02",
    credentials: "cdk_hunter01:HunterPass#9",
    batchCode: "LOT-261018-A",
    supplierName: "SeaVault_Studio",
    costPrice: 110,
    status: "AVAILABLE",
    importedAt: "2026-10-18 10:40",
  },
  {
    serialCode: "STK-BFCDK-261018-0004",
    productId: "prod_02",
    credentials: "cdk_hunter02:DualSword$22",
    batchCode: "LOT-261018-A",
    supplierName: "SeaVault_Studio",
    costPrice: 110,
    status: "SOLD",
    importedAt: "2026-10-18 09:10",
    orderNumber: "KZ-99412",
  },
  {
    serialCode: "STK-RBX500-261018-0005",
    productId: "p-rbx-500",
    credentials: "KEY-RBX500-A91F-72CC",
    batchCode: "LOT-261018-RBX",
    supplierName: "RobloxGroup_Direct",
    costPrice: 95,
    status: "SOLD",
    importedAt: "2026-10-18 08:30",
    orderNumber: "KZ-99388",
  },
  {
    serialCode: "STK-UNQKIT-261017-0006",
    productId: "prod_04",
    credentials: "kitsune_lord01:FoxFire@999:BACKUP-8821",
    batchCode: "LOT-261017-VIP",
    supplierName: "Vanguard_Collector",
    costPrice: 620,
    status: "AVAILABLE",
    importedAt: "2026-10-17 22:15",
  },
  {
    serialCode: "STK-BFSHK-261017-0007",
    productId: "prod_05",
    credentials: "shark_anchor76:OceanClaim!01",
    batchCode: "LOT-261017-B",
    supplierName: "GrandLine_Supply",
    costPrice: 145,
    status: "CLAIMED_DEFECTIVE",
    importedAt: "2026-10-17 21:10",
    orderNumber: "KZ-99401",
    defectReason: "ติดรหัส 2FA เดิมจากฟาร์ม (เปลี่ยนไอดีใหม่ให้ลูกค้าแล้ว)",
  },
  {
    serialCode: "STK-BFSHK-261017-0008",
    productId: "prod_05",
    credentials: "shark_anchor77:OceanDeep!12",
    batchCode: "LOT-261017-B",
    supplierName: "GrandLine_Supply",
    costPrice: 145,
    status: "AVAILABLE",
    importedAt: "2026-10-17 20:05",
  },
  {
    serialCode: "STK-BFSHK-261017-0009",
    productId: "prod_05",
    credentials: "shark_anchor78:Leviathan$55",
    batchCode: "LOT-261017-B",
    supplierName: "GrandLine_Supply",
    costPrice: 145,
    status: "SOLD",
    importedAt: "2026-10-17 19:45",
    orderNumber: "KZ-99408",
  },
  {
    serialCode: "STK-UNQAD-261017-0010",
    productId: "prod_03",
    credentials: "ad_mythic_star:DefenderPro#1:2FA-9001",
    batchCode: "LOT-261017-VIP",
    supplierName: "Vanguard_Collector",
    costPrice: 480,
    status: "SOLD",
    importedAt: "2026-10-17 18:10",
    orderNumber: "KZ-99410",
  },
  {
    serialCode: "STK-BFRND-261017-0011",
    productId: "prod_06",
    credentials: "rnd_box_091:RandomLuck@1",
    batchCode: "LOT-261017-C",
    supplierName: "KaitanFarm_TH",
    costPrice: 45,
    status: "AVAILABLE",
    importedAt: "2026-10-17 16:30",
  },
  {
    serialCode: "STK-BFRND-261017-0012",
    productId: "prod_06",
    credentials: "rnd_box_092:RandomLuck@2",
    batchCode: "LOT-261017-C",
    supplierName: "KaitanFarm_TH",
    costPrice: 45,
    status: "AVAILABLE",
    importedAt: "2026-10-17 16:30",
  },
  {
    serialCode: "STK-BFRND-261017-0013",
    productId: "prod_06",
    credentials: "rnd_box_093:RandomLuck@3",
    batchCode: "LOT-261017-C",
    supplierName: "KaitanFarm_TH",
    costPrice: 45,
    status: "SOLD",
    importedAt: "2026-10-17 16:29",
    orderNumber: "KZ-99409",
  },
  {
    serialCode: "STK-BFV4-261017-0014",
    productId: "prod_01",
    credentials: "bf_cyborg100:LeopardAwakened!9",
    batchCode: "LOT-261017-A",
    supplierName: "KaitanFarm_TH",
    costPrice: 190,
    status: "AVAILABLE",
    importedAt: "2026-10-17 14:00",
  },
  {
    serialCode: "STK-BFCDK-261017-0015",
    productId: "prod_02",
    credentials: "cdk_hunter03:SoulGuitar#77",
    batchCode: "LOT-261017-A",
    supplierName: "SeaVault_Studio",
    costPrice: 110,
    status: "AVAILABLE",
    importedAt: "2026-10-17 12:15",
  },
];

const initialStocks: StockItem[] = rawInitialSeed.map((seed, index) => {
  const product =
    targetProductOptions.find((p) => p.id === seed.productId) || targetProductOptions[0];
  const { hash, maskedIdentity } = computeCredentialHash(
    seed.credentials,
    product.credentialFormat,
  );
  return {
    id: `stk_${String(index + 1).padStart(2, "0")}`,
    serialCode: seed.serialCode,
    productId: product.id,
    productCode: product.code,
    productTitle: product.title,
    stockMode: product.stockMode,
    credentialFormat: product.credentialFormat,
    credentialHash: hash,
    maskedIdentity,
    credentials: seed.credentials,
    batchCode: seed.batchCode,
    supplierName: seed.supplierName,
    costPrice: seed.costPrice,
    defectReason: seed.defectReason,
    status: seed.status,
    importedAt: seed.importedAt,
    orderNumber: seed.orderNumber,
  };
});

export default function AdminStocksPage() {
  const [stocks, setStocks] = useState<StockItem[]>(initialStocks);
  const [selectedProductId, setSelectedProductId] = useState<string>(targetProductOptions[0].id);
  const [batchCodeInput, setBatchCodeInput] = useState<string>("LOT-261018-B");
  const [supplierInput, setSupplierInput] = useState<string>("KaitanFarm_TH");
  const [costPriceInput, setCostPriceInput] = useState<string>(
    String(targetProductOptions[0].defaultCost),
  );
  const [allowRestockOverride, setAllowRestockOverride] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const selectedProduct =
    targetProductOptions.find((p) => p.id === selectedProductId) || targetProductOptions[0];

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProductChange = (newProdId: string) => {
    setSelectedProductId(newProdId);
    const found = targetProductOptions.find((p) => p.id === newProdId);
    if (found) {
      setCostPriceInput(String(found.defaultCost));
    }
    setImportErrors([]);
  };

  const handleBatchImport = (e: React.FormEvent) => {
    e.preventDefault();
    setImportErrors([]);

    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      showNotification("กรุณาระบุรหัสสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    const errors: string[] = [];

    // 1. Check 1-to-1 Unique Product rule
    if (selectedProduct.stockMode === "UNIQUE_1TO1") {
      const existingActiveForUnique = stocks.filter(
        (s) => s.productId === selectedProduct.id && s.status === "AVAILABLE",
      );
      if (lines.length > 1) {
        errors.push(
          `รหัสสินค้า [${selectedProduct.code}] เป็นโหมด UNIQUE_1TO1 (ไอดีคัดเฉพาะ 1:1) นำเข้าได้ครั้งละ 1 ไอดีเท่านั้น`,
        );
      } else if (existingActiveForUnique.length > 0 && !allowRestockOverride) {
        errors.push(
          `รหัสสินค้า [${selectedProduct.code}] มีไอดีพร้อมขายอยู่ในคลังแล้ว (${existingActiveForUnique[0].serialCode}) ห้ามลงซ้ำในโหมด 1:1`,
        );
      }
    }

    // 2. Validate each line format + Global Unique Hash check
    const seenHashesInBatch = new Set<string>();
    const preparedItems: StockItem[] = [];
    const nowStr = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const skuShort = selectedProduct.code.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase();

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const formatCheck = validateCredentialFormat(line, selectedProduct.credentialFormat);
      if (!formatCheck.valid) {
        errors.push(`บรรทัดที่ ${lineNum}: ${formatCheck.reason}`);
        return;
      }

      const { hash, maskedIdentity, primaryKey } = computeCredentialHash(
        line,
        selectedProduct.credentialFormat,
      );

      if (seenHashesInBatch.has(hash)) {
        errors.push(
          `บรรทัดที่ ${lineNum}: พบไอดี "${primaryKey}" ซ้ำกันเองภายในรายการที่กำลังนำเข้า`,
        );
        return;
      }
      seenHashesInBatch.add(hash);

      const duplicateInDb = stocks.find((s) => s.credentialHash === hash);
      if (duplicateInDb && !allowRestockOverride) {
        errors.push(
          `บรรทัดที่ ${lineNum}: บล็อกไอดีซ้ำระดับ Global Hash (${hash.slice(0, 13)}) — เคยอยู่ในระบบแล้วที่รหัส ${duplicateInDb.serialCode} [สถานะ: ${duplicateInDb.status}]`,
        );
        return;
      }

      const seqNum = String(stocks.length + idx + 1).padStart(4, "0");
      preparedItems.push({
        id: `stk_${Date.now()}_${idx}`,
        serialCode: `STK-${skuShort}-261018-${seqNum}`,
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productTitle: selectedProduct.title,
        stockMode: selectedProduct.stockMode,
        credentialFormat: selectedProduct.credentialFormat,
        credentialHash: hash,
        maskedIdentity,
        credentials: line,
        batchCode: batchCodeInput.trim() || "LOT-DEFAULT",
        supplierName: supplierInput.trim() || "Internal_Stock",
        costPrice: parseFloat(costPriceInput) || 0,
        status: "AVAILABLE",
        importedAt: nowStr,
      });
    });

    if (errors.length > 0) {
      setImportErrors(errors);
      return;
    }

    setStocks((prev) => [...preparedItems, ...prev]);
    setImportText("");
    setAllowRestockOverride(false);
    setCurrentPage(1);
    showNotification(
      `ผ่านการตรวจสอบ Global Hash & Format — นำเข้าสำเร็จ ${preparedItems.length} รายการ`,
    );
  };

  const handleCycleStatus = (item: StockItem) => {
    const nextOrder: Record<StockStatus, StockStatus> = {
      AVAILABLE: "SOLD",
      SOLD: "CLAIMED_DEFECTIVE",
      CLAIMED_DEFECTIVE: "AVAILABLE",
    };
    const nextStatus = nextOrder[item.status];

    setStocks((prev) =>
      prev.map((s) => {
        if (s.id === item.id) {
          return {
            ...s,
            status: nextStatus,
            orderNumber:
              nextStatus === "SOLD" ? s.orderNumber || "KZ-MANUAL" : s.orderNumber,
            defectReason:
              nextStatus === "CLAIMED_DEFECTIVE"
                ? "แอดมินมาร์กไอดีมีปัญหา / เคลมในประกัน 24 ชม."
                : undefined,
          };
        }
        return s;
      }),
    );
    showNotification(`อัปเดตสถานะ ${item.serialCode} เป็น ${nextStatus}`);
  };

  const handleDeleteItem = (id: string) => {
    setStocks((prev) => prev.filter((item) => item.id !== id));
    showNotification("ลบรายการสต็อกออกจากระบบแล้ว");
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showNotification(`คัดลอก ${label} เรียบร้อย`);
  };

  const verification = verifySearchInput(searchQuery, searchMode);

  // Filtered stocks
  const filteredStocks = stocks.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (!verification.isValid) return false;

    if (searchMode === "ORDER_ID") {
      return (
        item.serialCode.toLowerCase().includes(q) ||
        (item.orderNumber ? item.orderNumber.toLowerCase().includes(q) : false)
      );
    }
    if (searchMode === "SKU_CODE") {
      return (
        item.productCode.toLowerCase().includes(q) ||
        item.serialCode.toLowerCase().includes(q) ||
        item.batchCode.toLowerCase().includes(q)
      );
    }
    if (searchMode === "USERNAME") {
      return (
        item.supplierName.toLowerCase().includes(q) ||
        item.maskedIdentity.toLowerCase().includes(q)
      );
    }
    if (searchMode === "NUMBER_PRICE") {
      return String(item.costPrice).includes(q);
    }

    return (
      item.serialCode.toLowerCase().includes(q) ||
      item.productCode.toLowerCase().includes(q) ||
      item.productTitle.toLowerCase().includes(q) ||
      item.batchCode.toLowerCase().includes(q) ||
      item.supplierName.toLowerCase().includes(q) ||
      item.maskedIdentity.toLowerCase().includes(q) ||
      item.credentialHash.toLowerCase().includes(q) ||
      String(item.costPrice).includes(q) ||
      (item.orderNumber && item.orderNumber.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStocks = filteredStocks.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const availableCount = stocks.filter((s) => s.status === "AVAILABLE").length;
  const soldCount = stocks.filter((s) => s.status === "SOLD").length;
  const claimedCount = stocks.filter((s) => s.status === "CLAIMED_DEFECTIVE").length;

  const formatPlaceholderMap: Record<CredentialFormat, string> = {
    USER_PASS: "bf_cyborg101:SecretPass!2026\nbf_cyborg102:AnotherPass#88",
    USER_PASS_2FA: "kitsune_vip01:FoxPass@99:BACKUP-CODE-7712",
    COOKIE_TOKEN: "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in|_",
    REDEEM_KEY: "KEY-RBX500-991A-882C\nKEY-RBX500-442B-119F",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">
            KZ // VAULT CREDENTIAL & SKU REPOSITORY
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight">
            คลังสต็อกรหัสเกม & ระบบตรวจสอบ SKU (Stock Vault Architecture)
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            รองรับ Hybrid Stock (Pool & 1:1 Unique), ตรวจจับรหัสซ้ำด้วย Global SHA-256 Hash และแยกติดตามล็อตซัพพลายเออร์
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">TOTAL VAULT:</span>
          <span className="px-3 py-1 rounded-sm text-xs font-mono font-bold text-zinc-950 bg-white num-tabular">
            {stocks.length} SERIALS
          </span>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3 rounded-md bg-zinc-900 border border-zinc-700 text-white text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Unified Architectural Metrics Strip (4 Columns) */}
      <div className="rounded-lg border border-zinc-800 bg-obsidian-900 overflow-hidden grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        <div className="p-4 space-y-1">
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
            01 // AVAILABLE IN VAULT
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-400 num-tabular">
            {availableCount} <span className="text-xs font-normal text-zinc-400">IDs</span>
          </p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
            02 // SOLD & DELIVERED
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            {soldCount} <span className="text-xs font-normal text-zinc-400">IDs</span>
          </p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
            03 // CLAIMED / DEFECTIVE
          </span>
          <p className="text-2xl font-bold font-mono text-amber-400 num-tabular">
            {claimedCount} <span className="text-xs font-normal text-zinc-400">IDs</span>
          </p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
            04 // VAULT INTEGRITY
          </span>
          <div className="flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-mono font-semibold text-zinc-200">
              AES-256 + SHA256 UNIQUE
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: Batch Uploader Form with SKU Mode + Format Guard + Batch Tracking */}
      <div className="rounded-lg p-5 sm:p-6 bg-obsidian-900 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              นำเข้าสต็อกพร้อมตรวจสอบโครงสร้าง & ป้องกันรหัสซ้ำ (Smart Stock Importer)
            </h2>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-sm bg-zinc-950 border border-zinc-700 text-zinc-300">
              MODE: {selectedProduct.stockMode}
            </span>
            <span className="px-2 py-0.5 rounded-sm bg-zinc-950 border border-zinc-700 text-emerald-400">
              FORMAT: {selectedProduct.credentialFormat}
            </span>
          </div>
        </div>

        {importErrors.length > 0 && (
          <div className="p-3.5 rounded-md bg-red-950/30 border border-red-500/40 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>ระบบปฏิเสธการนำเข้าเนื่องจากไม่ผ่านกฎความปลอดภัยของฐานข้อมูล:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-300 space-y-0.5 font-mono">
              {importErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleBatchImport} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                เลือกสินค้าเป้าหมาย (Product SKU)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white focus:outline-none"
              >
                {targetProductOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-obsidian-950 text-white">
                    [{opt.code}] ({opt.stockMode}) — {opt.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                รหัสล็อตนำเข้า (Batch Code)
              </label>
              <input
                type="text"
                value={batchCodeInput}
                onChange={(e) => setBatchCodeInput(e.target.value)}
                placeholder="เช่น LOT-261018-B"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  ซัพพลายเออร์ (Supplier)
                </label>
                <input
                  type="text"
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  placeholder="ชื่อฟาร์ม/แม่ค้า"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  ต้นทุน/ชิ้น (THB)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costPriceInput}
                  onChange={(e) => setCostPriceInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white font-mono num-tabular focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <label className="text-xs font-medium text-zinc-300">
                รายการข้อมูลรหัสลับ (บังคับโครงสร้าง{" "}
                <span className="font-mono text-white">{selectedProduct.credentialFormat}</span>)
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">
                {importText.split("\n").filter((l) => l.trim().length > 0).length} LINES READY
              </span>
            </div>
            <textarea
              rows={3}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={formatPlaceholderMap[selectedProduct.credentialFormat]}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-3 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowRestockOverride}
                onChange={(e) => setAllowRestockOverride(e.target.checked)}
                className="rounded-sm bg-zinc-950 border-zinc-700"
              />
              <span>
                อนุญาต Re-stock Override (เฉพาะกรณีดึงไอดีที่เคลมแล้วกลับมาเปลี่ยนรหัสผ่านลงขายใหม่)
              </span>
            </label>

            <button
              type="submit"
              className="px-5 py-2 rounded-md text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2 self-end sm:self-auto cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>ตรวจสอบ & บันทึกเข้า Vault</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Stock Inventory Table */}
      <div className="space-y-4">
        <AdminSmartFilterBar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          searchMode={searchMode}
          onSearchModeChange={(m) => {
            setSearchMode(m);
            setCurrentPage(1);
          }}
          placeholder="ค้นหา Serial (STK-...), รหัส SKU, ล็อตนำเข้า, ชื่อฟาร์ม หรือต้นทุน..."
          totalMatched={filteredStocks.length}
          totalAll={stocks.length}
        >
          <div className="flex p-1 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ALL ({stocks.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("AVAILABLE");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "AVAILABLE"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              AVAILABLE ({availableCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("SOLD");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "SOLD"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              SOLD ({soldCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("CLAIMED_DEFECTIVE");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "CLAIMED_DEFECTIVE"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              CLAIMED ({claimedCount})
            </button>
          </div>
        </AdminSmartFilterBar>

        {/* Table + Pagination */}
        <div className="rounded-xl overflow-hidden bg-obsidian-900 border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-200">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-xs font-mono uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-3.5 px-4">SERIAL / HASH</th>
                  <th className="py-3.5 px-4">PRODUCT SKU & MODE</th>
                  <th className="py-3.5 px-4">CREDENTIALS (AES-256)</th>
                  <th className="py-3.5 px-4">BATCH / SUPPLIER / COST</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {paginatedStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-400 text-sm">
                      ไม่พบรายการสต็อกที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  paginatedStocks.map((item) => {
                    const isRevealed = revealedIds[item.id];

                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/25 transition-colors">
                        {/* SERIAL / HASH */}
                        <td className="py-4 px-4 font-mono">
                          <span className="text-xs font-bold text-white block">
                            {item.serialCode}
                          </span>
                          <span
                            className="text-xs text-zinc-400 block"
                            title="Global Unique Credential Hash (HMAC-SHA256)"
                          >
                            {item.credentialHash}
                          </span>
                          <span className="text-xs text-zinc-500 block mt-0.5 num-tabular">
                            {item.importedAt}
                          </span>
                        </td>

                        {/* PRODUCT SKU & MODE */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-mono text-xs font-bold text-zinc-200">
                              {item.productCode}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono border ${
                                item.stockMode === "UNIQUE_1TO1"
                                  ? "bg-zinc-100 text-zinc-950 border-white font-bold"
                                  : "bg-zinc-900 text-zinc-300 border-zinc-700"
                              }`}
                            >
                              {item.stockMode === "UNIQUE_1TO1" ? "1:1 UNIQUE" : "POOL"}
                            </span>
                          </div>
                          <span className="font-medium text-white text-sm block max-w-xs truncate">
                            {item.productTitle}
                          </span>
                        </td>

                        {/* CREDENTIALS */}
                        <td className="py-4 px-4 font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300">
                              {item.credentialFormat}
                            </span>
                            <span className="text-white font-semibold">
                              {isRevealed
                                ? item.credentials
                                : `${item.maskedIdentity} : ••••••••`}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleReveal(item.id)}
                              title={isRevealed ? "ซ่อนรหัสจริง" : "ถอดรหัสเพื่อดูข้อมูล"}
                              className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                              {isRevealed ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.credentials, item.serialCode)}
                              title="คัดลอกข้อมูล"
                              className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          {item.orderNumber && (
                            <span className="text-xs text-zinc-400 font-mono block mt-1">
                              ORDER REF: <strong className="text-white">{item.orderNumber}</strong>
                            </span>
                          )}
                          {item.defectReason && (
                            <span className="text-xs text-amber-400 block mt-0.5">
                              CLAIM NOTE: {item.defectReason}
                            </span>
                          )}
                        </td>

                        {/* BATCH / SUPPLIER / COST */}
                        <td className="py-4 px-4 font-mono text-xs">
                          <span className="text-white font-semibold block">{item.batchCode}</span>
                          <span className="text-zinc-300 block">
                            SUP: {item.supplierName}
                          </span>
                          <span className="text-zinc-400 block num-tabular">
                            COST: ฿{item.costPrice.toLocaleString()}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="py-4 px-4">
                          {item.status === "AVAILABLE" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              AVAILABLE
                            </span>
                          )}
                          {item.status === "SOLD" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700">
                              SOLD
                            </span>
                          )}
                          {item.status === "CLAIMED_DEFECTIVE" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              CLAIMED / DEFECT
                            </span>
                          )}
                        </td>

                        {/* ACTION */}
                        <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleCycleStatus(item)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                            title="คลิกเพื่อสลับสถานะ AVAILABLE -> SOLD -> CLAIMED_DEFECTIVE"
                          >
                            {item.status === "AVAILABLE"
                              ? "มาร์กขายแล้ว"
                              : item.status === "SOLD"
                                ? "มาร์กงานเคลม"
                                : "คืนสต็อกปกติ"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors inline-flex items-center cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            currentPage={safePage}
            totalItems={filteredStocks.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="รหัสในคลัง"
          />
        </div>
      </div>
    </div>
  );
}
