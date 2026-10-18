"use client";

import { useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

interface StockItem {
  id: string;
  productId: string;
  productCode: string;
  productTitle: string;
  credentials: string; // e.g. "roblox_user:password123" or "KEY-1234-5678"
  status: "AVAILABLE" | "SOLD";
  importedAt: string;
  orderNumber?: string;
}

const initialStocks: StockItem[] = [
  {
    id: "stk_01",
    productId: "prod_01",
    productCode: "BF-V4-MAX-01",
    productTitle: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น",
    credentials: "bf_cyborg99:P@ssword2026",
    status: "AVAILABLE",
    importedAt: "2026-10-17 11:20",
  },
  {
    id: "stk_02",
    productId: "prod_01",
    productCode: "BF-V4-MAX-01",
    productTitle: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น",
    credentials: "bf_master_god:SafeSecret!77",
    status: "AVAILABLE",
    importedAt: "2026-10-17 11:25",
  },
  {
    id: "stk_03",
    productId: "prod_02",
    productCode: "BF-CDK-MAX-02",
    productTitle: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ",
    credentials: "cdk_hunter01:HunterPass#9",
    status: "AVAILABLE",
    importedAt: "2026-10-16 19:40",
  },
  {
    id: "stk_04",
    productId: "prod_02",
    productCode: "BF-CDK-MAX-02",
    productTitle: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ",
    credentials: "cdk_hunter02:DualSword$22",
    status: "SOLD",
    importedAt: "2026-10-16 15:10",
    orderNumber: "ORD-99412",
  },
  {
    id: "stk_05",
    productId: "p-rbx-500",
    productCode: "RBX-500",
    productTitle: "เติม Robux 500 R$ ระบบกลุ่มอัตโนมัติ ส่งเข้า ID ทันที",
    credentials: "KEY-RBX500-A91F-72CC",
    status: "SOLD",
    importedAt: "2026-10-16 09:30",
    orderNumber: "ORD-99388",
  },
];

const targetProductOptions = [
  { id: "prod_01", code: "BF-V4-MAX-01", title: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น" },
  { id: "prod_02", code: "BF-CDK-MAX-02", title: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ" },
  { id: "prod_03", code: "AD-MYTHIC-03", title: "Anime Defenders Unit Mythic ลิมิเต็ด อัปเกรดดาวเต็ม" },
  { id: "p-rbx-500", code: "RBX-500", title: "เติม Robux 500 R$ ระบบกลุ่มอัตโนมัติ ส่งเข้า ID ทันที" },
  { id: "p-rbx-1000", code: "RBX-1000", title: "เติม Robux 1,000 R$ เรทพิเศษ คุ้มครองความปลอดภัย 100%" },
];

export default function AdminStocksPage() {
  const [stocks, setStocks] = useState<StockItem[]>(initialStocks);
  const [selectedProductId, setSelectedProductId] = useState<string>(targetProductOptions[0].id);
  const [importText, setImportText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "SOLD">("ALL");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle batch import
  const handleBatchImport = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      showNotification("กรุณาระบุรหัสสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    const target = targetProductOptions.find((p) => p.id === selectedProductId) || targetProductOptions[0];
    const nowStr = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    const newItems: StockItem[] = lines.map((line, idx) => ({
      id: `stk_${Date.now()}_${idx}`,
      productId: target.id,
      productCode: target.code,
      productTitle: target.title,
      credentials: line,
      status: "AVAILABLE",
      importedAt: nowStr,
    }));

    setStocks((prev) => [...newItems, ...prev]);
    setImportText("");
    showNotification(`นำเข้ารหัสสินค้าสำเร็จจำนวน ${newItems.length} รายการ`);
  };

  // Toggle status between AVAILABLE and SOLD
  const handleToggleStatus = (id: string) => {
    setStocks((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === "AVAILABLE" ? "SOLD" : "AVAILABLE";
          return {
            ...item,
            status: nextStatus,
            orderNumber: nextStatus === "SOLD" ? "ORD-MANUAL" : undefined,
          };
        }
        return item;
      }),
    );
    showNotification("อัปเดตสถานะสต็อกเรียบร้อย");
  };

  // Delete stock item
  const handleDeleteItem = (id: string) => {
    setStocks((prev) => prev.filter((item) => item.id !== id));
    showNotification("ลบรายการสต็อกออกจากระบบแล้ว");
  };

  // Copy credentials
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification("คัดลอกข้อมูลสต็อกเรียบร้อย");
  };

  // Filtered stocks
  const filteredStocks = stocks.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.productCode.toLowerCase().includes(q) ||
      item.productTitle.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.credentials.toLowerCase().includes(q) ||
      (item.orderNumber && item.orderNumber.toLowerCase().includes(q))
    );
  });

  const availableCount = stocks.filter((s) => s.status === "AVAILABLE").length;
  const soldCount = stocks.filter((s) => s.status === "SOLD").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            คลังสต็อกรหัสเกม (Stock Management)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            นำเข้ารหัสไอดีเกม คีย์ส่งมอบอัตโนมัติ และตรวจสอบสถานะสต็อกแบบเรียลไทม์
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">สต็อกรวมในคลัง:</span>
          <span className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-white/[0.08] border border-white/10 num-tabular">
            {stocks.length} รายการ
          </span>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            พร้อมส่งมอบอัตโนมัติ
          </span>
          <p className="text-2xl font-bold text-emerald-400 num-tabular">
            {availableCount} <span className="text-xs font-normal text-slate-400">รายการ</span>
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ตัดจ่ายสำเร็จ (ขายแล้ว)
          </span>
          <p className="text-2xl font-bold text-slate-300 num-tabular">
            {soldCount} <span className="text-xs font-normal text-slate-400">รายการ</span>
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ระบบความปลอดภัย VAULT
          </span>
          <p className="text-sm font-semibold text-blue-400 pt-1">
            เข้ารหัส AES-256 ปลอดภัย
          </p>
        </div>
      </div>

      {/* SECTION 1: Batch Uploader Form */}
      <div className="luxury-card rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
          <Boxes className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            นำเข้ารหัสสต็อกสินค้าใหม่ (Batch Stock Import)
          </h2>
        </div>

        <form onSubmit={handleBatchImport} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                เลือกสินค้าเป้าหมาย
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              >
                {targetProductOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-obsidian-950 text-white">
                    [{opt.code}] {opt.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                คำแนะนำรูปแบบข้อมูล
              </label>
              <p className="text-xs text-slate-400 leading-relaxed bg-obsidian-900/60 border border-white/[0.06] rounded-xl p-2.5">
                วางบรรทัดละ 1 ชิ้น ในรูปแบบ <span className="font-mono text-blue-400">USER:PASS</span> หรือ <span className="font-mono text-blue-400">KEY-XXXX-XXXX</span>
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                รายการรหัส (วางหลายรายการพร้อมกันได้)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {importText.split("\n").filter((l) => l.trim().length > 0).length} รายการ
              </span>
            </div>
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="user_test1:pass1234&#10;user_test2:pass5678&#10;KEY-ROBUX-9988-1122"
              className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>บันทึกสต็อกเข้าสู่ระบบ</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Stock Inventory Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-wide">
              รายการสต็อกทั้งหมดในระบบ
            </h2>
            <span className="text-xs text-slate-400 font-mono">({filteredStocks.length})</span>
          </div>

          {/* Filter & Search Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex p-0.5 rounded-lg bg-obsidian-900 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === "ALL" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("AVAILABLE")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === "AVAILABLE" ? "bg-white/[0.1] text-emerald-400" : "text-slate-400 hover:text-white"
                }`}
              >
                พร้อมส่ง ({availableCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("SOLD")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === "SOLD" ? "bg-white/[0.1] text-slate-200" : "text-slate-400 hover:text-white"
                }`}
              >
                ขายแล้ว ({soldCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัส หรือ สินค้า..."
                className="w-48 sm:w-56 bg-obsidian-900 border border-white/[0.08] focus:border-white/20 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="luxury-card rounded-xl overflow-hidden border border-white/[0.08]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-obsidian-900 border-b border-white/[0.08] text-[11px] font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">รหัสสต็อก</th>
                  <th className="py-3 px-4">สินค้า</th>
                  <th className="py-3 px-4">ข้อมูลส่งมอบ (Credentials)</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4">วันที่นำเข้า</th>
                  <th className="py-3 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      ไม่พบรายการสต็อกที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((item) => {
                    const isRevealed = revealedIds[item.id];
                    const isAvailable = item.status === "AVAILABLE";

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {item.id}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[10px] text-blue-400 block">
                            {item.productCode}
                          </span>
                          <span className="font-medium text-white block max-w-xs truncate">
                            {item.productTitle}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span>
                              {isRevealed
                                ? item.credentials
                                : item.credentials.slice(0, 4) + "••••••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleReveal(item.id)}
                              title={isRevealed ? "ซ่อนข้อมูล" : "แสดงข้อมูล"}
                              className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              {isRevealed ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.credentials)}
                              title="คัดลอกข้อมูล"
                              className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {item.orderNumber && (
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              ออเดอร์: {item.orderNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isAvailable ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              พร้อมส่งมอบ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.06] text-slate-400 border border-white/10">
                              ตัดจ่ายแล้ว
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] num-tabular">
                          {item.importedAt}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item.id)}
                            className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-[11px] transition-colors cursor-pointer"
                          >
                            {isAvailable ? "มาร์กเป็นตัดจ่ายแล้ว" : "คืนเป็นพร้อมส่ง"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors inline-flex items-center cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
