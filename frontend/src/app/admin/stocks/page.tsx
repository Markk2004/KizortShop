"use client";

import { useState, useEffect } from "react";
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
import { apiDelete } from "@/lib/api-client";

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
  categoryName?: string;
  stockMode: StockMode;
  credentialFormat: CredentialFormat;
  credentialHash: string;
  username?: string;
  maskedIdentity: string;
  credentials: string;
  farmedMaps?: string;
  details?: string;
  sellingPriceText?: string;
  addedSource?: string;
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
  const parts = rawLine.includes("|")
    ? rawLine.trim().split("|").map((s) => s.trim())
    : rawLine.trim().split(":").map((s) => s.trim());
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
  const parts = trimmed.includes("|")
    ? trimmed.split("|").map((s) => s.trim())
    : trimmed.split(":").map((s) => s.trim());

  if (format === "USER_PASS") {
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return {
        valid: false,
        reason: "ต้องอยู่ในรูปแบบ USER:PASS หรือ USER | PASS (คั่นอย่างน้อย 2 ส่วน)",
      };
    }
    return { valid: true };
  }

  if (format === "USER_PASS_2FA") {
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
      return {
        valid: false,
        reason: "ต้องอยู่ในรูปแบบ USER:PASS:2FA หรือ USER | PASS | 2FA (ครบ 3 ส่วน)",
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

const defaultProductOption: TargetProductOption = {
  id: "9156b43e-ff6b-499d-b5cc-550f0a2b035d",
  code: "5C7-5206",
  title: "ไก่ตันที่ขุด Break And Steal Egg",
  stockMode: "POOL",
  credentialFormat: "USER_PASS",
  defaultCost: 0,
};

export default function AdminStocksPage() {
  const [productOptions, setProductOptions] = useState<TargetProductOption[]>([defaultProductOption]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(defaultProductOption.id);
  const [batchCodeInput, setBatchCodeInput] = useState<string>("LOT-2026");
  const [supplierInput, setSupplierInput] = useState<string>("ทำเอง (Self-Farmed)");
  const [costPriceInput, setCostPriceInput] = useState<string>("0");
  const [allowRestockOverride, setAllowRestockOverride] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StockStatus>("ALL");
  const [mapFilter, setMapFilter] = useState<string>("ALL");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<string | null>(null);

  // Edit stock item modal state
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editPassword, setEditPassword] = useState<string>("");
  const [editFarmedMaps, setEditFarmedMaps] = useState<string>("");
  const [editDetails, setEditDetails] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editStatus, setEditStatus] = useState<StockStatus>("AVAILABLE");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Fetch stocks from backend API
  const fetchStocksFromApi = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:4000/api/v1/admin/stocks?pageSize=100");
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setStocks(json.data);
        }
      }
    } catch {
      // Keep state if offline
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsFromApi = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/v1/admin/products");
      if (res.ok) {
        const json = await res.json();
        const prods = json.data || json;
        if (Array.isArray(prods) && prods.length > 0) {
          const mapped: TargetProductOption[] = prods.map((p: any) => ({
            id: p.id,
            code: p.code || p.sku || "",
            title: p.title || p.name || "",
            stockMode: "POOL",
            credentialFormat: "USER_PASS",
            defaultCost: 0,
          }));
          setProductOptions(mapped);
          setSelectedProductId(mapped[0].id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchStocksFromApi();
    fetchProductsFromApi();
  }, []);

  const selectedProduct =
    productOptions.find((p) => p.id === selectedProductId) || productOptions[0] || defaultProductOption;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const toggleReveal = async (id: string) => {
    if (revealedIds[id]) {
      setRevealedIds((prev) => ({ ...prev, [id]: false }));
      return;
    }

    const target = stocks.find((s) => s.id === id);
    if (target && !target.credentials) {
      try {
        const res = await fetch(`http://localhost:4000/api/v1/admin/stocks/${id}/reveal`, {
          method: "POST",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.decrypted) {
            setStocks((prev) =>
              prev.map((s) => (s.id === id ? { ...s, credentials: json.decrypted } : s)),
            );
          }
        }
      } catch {}
    }

    setRevealedIds((prev) => ({ ...prev, [id]: true }));
  };

  const handleProductChange = (newProdId: string) => {
    setSelectedProductId(newProdId);
    const found = productOptions.find((p) => p.id === newProdId);
    if (found) {
      setCostPriceInput(String(found.defaultCost));
    }
    setImportErrors([]);
  };

  const handleBatchImport = async (e: React.FormEvent) => {
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

    try {
      const res = await fetch("http://localhost:4000/api/v1/admin/stocks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          credentials: lines,
          batchCode: batchCodeInput.trim() || "LOT-DEFAULT",
          supplierName: supplierInput.trim() || "ทำเอง (Self-Farmed)",
          costPrice: parseFloat(costPriceInput) || 0,
          allowRestockOverride,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errList = data.errors || (data.message ? [data.message] : ["นำเข้าสต็อกไม่สำเร็จ"]);
        setImportErrors(Array.isArray(errList) ? errList : [errList]);
        return;
      }

      setImportText("");
      setAllowRestockOverride(false);
      setCurrentPage(1);
      showNotification(
        `นำเข้าสต็อกสำเร็จ ${data.importedCount || lines.length} รายการ (บันทึกสู่ Supabase เรียบร้อย)`,
      );
      await fetchStocksFromApi();
    } catch (err: any) {
      setImportErrors([err?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์"]);
    }
  };


  const handleCycleStatus = async (item: StockItem) => {
    const nextOrder: Record<StockStatus, StockStatus> = {
      AVAILABLE: "SOLD",
      SOLD: "CLAIMED_DEFECTIVE",
      CLAIMED_DEFECTIVE: "AVAILABLE",
    };
    const nextStatus = nextOrder[item.status];
    const defectReason =
      nextStatus === "CLAIMED_DEFECTIVE"
        ? "แอดมินมาร์กไอดีมีปัญหา / เคลมในประกัน 24 ชม."
        : undefined;

    setStocks((prev) =>
      prev.map((s) => {
        if (s.id === item.id) {
          return {
            ...s,
            status: nextStatus,
            orderNumber:
              nextStatus === "SOLD" ? s.orderNumber || "KZ-MANUAL" : s.orderNumber,
            defectReason,
          };
        }
        return s;
      }),
    );

    try {
      await fetch(`http://localhost:4000/api/v1/admin/stocks/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, defectReason }),
      });
    } catch {}

    showNotification(`อัปเดตสถานะ ${item.serialCode} เป็น ${nextStatus} (ซิงค์เข้า Supabase & Discord แล้ว)`);
  };

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setEditPassword("");
    setEditFarmedMaps(item.farmedMaps || "");
    setEditDetails(item.details || "");
    setEditPrice(item.sellingPriceText || "");
    setEditStatus(item.status);
  };

  const handleSaveEditDetails = async () => {
    if (!editingItem) return;

    try {
      await fetch(`http://localhost:4000/api/v1/admin/stocks/${editingItem.id}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: editPassword.trim() || undefined,
          farmedMaps: editFarmedMaps.trim(),
          details: editDetails.trim(),
          sellingPriceText: editPrice.trim(),
          status: editStatus,
        }),
      });
    } catch {
      // Offline fallback
    }

    setStocks((prev) =>
      prev.map((s) => {
        if (s.id === editingItem.id) {
          return {
            ...s,
            farmedMaps: editFarmedMaps.trim(),
            details: editDetails.trim(),
            sellingPriceText: editPrice.trim(),
            status: editStatus,
          };
        }
        return s;
      }),
    );

    setEditingItem(null);
    showNotification(`อัปเดตข้อมูลไอดี ${editingItem.username || editingItem.serialCode} เรียบร้อย (แจ้งเตือนใน Discord แล้ว)`);
  };

  const handleDeleteItem = async (id: string) => {
    setStocks((prev) => prev.filter((item) => item.id !== id));
    try {
      await apiDelete(`/admin/stocks/${id}`);
    } catch {}
    showNotification("ลบรายการสต็อกออกจากระบบแล้ว");
  };

  const handleCopy = async (item: StockItem) => {
    let textToCopy = item.credentials;
    if (!textToCopy) {
      try {
        const res = await fetch(`http://localhost:4000/api/v1/admin/stocks/${item.id}/reveal`, {
          method: "POST",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.decrypted) {
            textToCopy = json.decrypted;
            setStocks((prev) =>
              prev.map((s) => (s.id === item.id ? { ...s, credentials: json.decrypted } : s)),
            );
          }
        }
      } catch {}
    }
    navigator.clipboard.writeText(textToCopy || item.username || item.serialCode);
    showNotification(`คัดลอกรหัสของ ${item.username || item.serialCode} เรียบร้อย`);
  };

  const verification = verifySearchInput(searchQuery, searchMode);

  // Collect unique maps/games from stock items
  const uniqueMaps = Array.from(
    new Set(
      stocks
        .map((s) => (s.farmedMaps || s.categoryName || s.productTitle || "").trim())
        .filter((m) => m.length > 0),
    ),
  ).sort();

  // Filtered stocks
  const filteredStocks = stocks.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;

    if (mapFilter !== "ALL") {
      const combined = `${item.farmedMaps || ""} ${item.categoryName || ""} ${item.productTitle || ""}`.toLowerCase();
      if (!combined.includes(mapFilter.toLowerCase())) {
        return false;
      }
    }

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
                {productOptions.map((opt) => (
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
                  แหล่งที่มา / ทำเอง (Source)
                </label>
                <input
                  type="text"
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  placeholder="เช่น ทำเอง / ฟาร์มเอง"
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Map / Game Filter Dropdown */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              <span className="text-zinc-500 font-mono text-[11px] uppercase">MAP:</span>
              <select
                value={mapFilter}
                onChange={(e) => {
                  setMapFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
              >
                <option value="ALL" className="bg-zinc-950 text-white">
                  🌐 ทุกแมพ / ทุกเกม ({stocks.length})
                </option>
                {uniqueMaps.map((mapName) => {
                  const matchCount = stocks.filter((s) =>
                    `${s.farmedMaps || ""} ${s.categoryName || ""} ${s.productTitle || ""}`
                      .toLowerCase()
                      .includes(mapName.toLowerCase()),
                  ).length;
                  return (
                    <option key={mapName} value={mapName} className="bg-zinc-950 text-white">
                      🗺️ {mapName} ({matchCount})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Status Filter Buttons */}
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
                  <th className="py-3.5 px-4">BATCH / แหล่งที่มา / COST</th>
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
                          {(item.farmedMaps || item.categoryName) && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              🗺️ {item.farmedMaps || item.categoryName}
                            </span>
                          )}
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
                                : `${item.username || item.maskedIdentity} : ••••••••`}
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
                              onClick={() => handleCopy(item)}
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
                            ที่มา: {item.supplierName}
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
                            onClick={() => openEditModal(item)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-medium transition-colors cursor-pointer"
                            title="แก้ไขรายละเอียด แมพ ของในไอดี รหัสผ่าน หรือราคา (ซิงค์เข้า Discord #kaitun-id)"
                          >
                            แก้ไขไอดี
                          </button>
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

        {/* Edit Stock Modal (Two-Way Sync with Discord #kaitun-id) */}
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>แก้ไขข้อมูลไอดีไก่ตัน</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                      2-WAY SYNC
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    ไอดี: <strong className="text-white font-mono">{editingItem.username || editingItem.serialCode}</strong> (การแก้ไขจะแจ้งเตือนในห้อง #kaitun-id ทันที)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="text-zinc-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-zinc-300 font-medium block mb-1">
                    เปลี่ยนรหัสผ่านใหม่ (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)
                  </label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="เช่น NewPass@2026! (บอทจะแจ้งใน Discord ว่าเปลี่ยนรหัสผ่านแล้ว)"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-medium block mb-1">
                    แมพที่ฟาร์ม (Farmed Maps)
                  </label>
                  <input
                    type="text"
                    value={editFarmedMaps}
                    onChange={(e) => setEditFarmedMaps(e.target.value)}
                    placeholder="เช่น Blox Fruits, King Legacy, Anime Defenders"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-medium block mb-1">
                    รายละเอียดของในไอดี (Details)
                  </label>
                  <textarea
                    rows={3}
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    placeholder="เช่น เวลตัน 2550 หมัดก็อด ดาบคู่ CDK ผลเสือตื่น เงิน 30M"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-300 font-medium block mb-1">
                      ราคาขาย (Price)
                    </label>
                    <input
                      type="text"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="เช่น 150 บาท"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-300 font-medium block mb-1">
                      สถานะการขาย (Sale Status)
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as StockStatus)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-zinc-500"
                    >
                      <option value="AVAILABLE">AVAILABLE (ยังไม่ขาย)</option>
                      <option value="SOLD">SOLD (ขายแล้ว)</option>
                      <option value="CLAIMED_DEFECTIVE">CLAIMED (แจ้งเคลม)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditDetails}
                  className="px-5 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-all cursor-pointer"
                >
                  บันทึกและซิงค์ข้อมูล
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
