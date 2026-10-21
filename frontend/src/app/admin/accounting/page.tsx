"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Layers,
  Plus,
  Receipt,
  Send,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatBaht, formatSignedBaht } from "@/lib/format";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

type TimeRange = "ALL" | "TODAY" | "YESTERDAY" | "7D" | "MONTH";

interface AccountingSummary {
  grossRevenue: number;
  productCost: number;
  operatingExpenses: number;
  defectLoss: number;
  netProfit: number;
  profitMargin: number;
  inventoryCost: number;
  potentialRevenue: number;
  soldCount: number;
  availableCount: number;
  totalExpensesCount: number;
}

interface MapBreakdown {
  mapName: string;
  soldCount: number;
  availableCount: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  note: string;
  paidAt: string;
}

interface SaleItem {
  id: string;
  serialCode: string;
  username: string;
  productTitle: string;
  map: string;
  sellingPrice: number;
  cost: number;
  profit: number;
  soldAt: string;
}

interface AccountingReportData {
  timeRange: string;
  summary: AccountingSummary;
  breakdownByMap: MapBreakdown[];
  expenses: ExpenseItem[];
  recentSales: SaleItem[];
}

const expenseCategories: Record<string, { label: string; icon: string }> = {
  SCRIPT: { label: "ค่าสคริปต์ฟาร์ม", icon: "📜" },
  VPS: { label: "ค่า VPS / เซิร์ฟเวอร์", icon: "💻" },
  ELECTRICITY: { label: "ค่าไฟ / ค่าฮาร์ดแวร์", icon: "⚡" },
  BOT_HOST: { label: "ค่าโฮสต์บอท Discord", icon: "🤖" },
  OTHER: { label: "รายจ่ายอื่นๆ", icon: "📦" },
};

export default function AdminExpensePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [data, setData] = useState<AccountingReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"BREAKDOWN" | "EXPENSES" | "SALES">("BREAKDOWN");
  const [notification, setNotification] = useState<string | null>(null);

  // Add Expense Modal state
  const [showAddExpense, setShowAddExpense] = useState<boolean>(false);
  const [expenseTitle, setExpenseTitle] = useState<string>("");
  const [expenseCategory, setExpenseCategory] = useState<string>("SCRIPT");
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseNote, setExpenseNote] = useState<string>("");
  const [submittingExpense, setSubmittingExpense] = useState<boolean>(false);

  // Push Discord state
  const [pushingDiscord, setPushingDiscord] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async (range: TimeRange = timeRange) => {
    try {
      setLoading(true);
      const res = await apiGet<AccountingReportData>(`/admin/expense?timeRange=${range}`);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load accounting data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeRange);
  }, [timeRange]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) {
      showToast("กรุณาระบุชื่อรายการค่าใช้จ่าย");
      return;
    }
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("กรุณาระบุจำนวนเงินที่ถูกต้อง");
      return;
    }

    try {
      setSubmittingExpense(true);
      await apiPost("/admin/expense/expenses", {
        title: expenseTitle.trim(),
        category: expenseCategory,
        amount: amt,
        note: expenseNote.trim() || undefined,
      });

      showToast(`บันทึกค่าใช้จ่าย "${expenseTitle}" ฿${amt.toLocaleString()} เรียบร้อย`);
      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseNote("");
      setShowAddExpense(false);
      await loadData();
    } catch (err: any) {
      showToast("บันทึกค่าใช้จ่ายไม่สำเร็จ: " + (err?.message || ""));
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบรายการค่าใช้จ่าย "${title}" ใช่หรือไม่?`)) return;
    try {
      await apiDelete(`/admin/expense/expenses/${id}`);
      showToast(`ลบรายการ "${title}" เรียบร้อย`);
      await loadData();
    } catch {
      showToast("ไม่สามารถลบรายการได้");
    }
  };

  const handlePushDiscord = async () => {
    try {
      setPushingDiscord(true);
      await apiPost("/admin/expense/push-discord", {});
      showToast("ส่งรายงานสรุปยอดขาย-กำไร เข้าห้อง Discord เรียบร้อยแล้ว!");
    } catch (err: any) {
      showToast("ส่งแจ้งเตือน Discord ไม่สำเร็จ: " + (err?.message || ""));
    } finally {
      setPushingDiscord(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;

    const rows: string[][] = [];
    rows.push(["รายงานบัญชีการเงินร้าน KaiZort Store (Accounting & Expense Export)"]);
    rows.push([`ช่วงเวลา: ${timeRange}`, `วันที่พิมพ์: ${new Date().toLocaleString("th-TH")}`]);
    rows.push([]);

    rows.push(["=== สรุปภาพรวมการเงิน ==="]);
    rows.push(["ยอดขายจริงรวม (บาท)", String(data.summary.grossRevenue)]);
    rows.push(["ต้นทุนไอดี (บาท)", String(data.summary.productCost)]);
    rows.push(["ค่าใช้จ่ายร้าน (บาท)", String(data.summary.operatingExpenses)]);
    rows.push(["กำไรสุทธิแท้จริง (บาท)", String(data.summary.netProfit)]);
    rows.push(["อัตรากำไร (%)", `${data.summary.profitMargin}%`]);
    rows.push(["มูลค่าสต็อกคงเหลือ (บาท)", String(data.summary.potentialRevenue)]);
    rows.push(["จำนวนไอดีที่ขาย (บัญชี)", String(data.summary.soldCount)]);
    rows.push(["จำนวนไอดีพร้อมขาย (บัญชี)", String(data.summary.availableCount)]);
    rows.push([]);

    rows.push(["=== แจกแจงตามแมพ / หมวดหมู่เกม ==="]);
    rows.push(["แมพ/สินค้า", "ขายแล้ว", "คงเหลือ", "ยอดขายรวม (บาท)", "ต้นทุน (บาท)", "กำไรสุทธิ (บาท)", "อัตรากำไร (%)"]);
    data.breakdownByMap.forEach((m) => {
      const margin = m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : "0";
      rows.push([m.mapName, String(m.soldCount), String(m.availableCount), String(m.revenue), String(m.cost), String(m.profit), `${margin}%`]);
    });
    rows.push([]);

    rows.push(["=== รายการค่าใช้จ่ายร้าน (Operating Expenses) ==="]);
    rows.push(["วันที่จ่าย", "รายการ", "หมวดหมู่", "จำนวนเงิน (บาท)", "หมายเหตุ"]);
    data.expenses.forEach((e) => {
      rows.push([new Date(e.paidAt).toLocaleDateString("th-TH"), e.title, expenseCategories[e.category]?.label || e.category, String(e.amount), e.note]);
    });
    rows.push([]);

    rows.push(["=== รายการไอดีที่ขายออกล่าสุด (Sales Ledger) ==="]);
    rows.push(["วันที่ขาย", "รหัสซีเรียล", "ชื่อไอดี", "สินค้า/แมพ", "ราคาขาย (บาท)", "ต้นทุน (บาท)", "กำไร (บาท)"]);
    data.recentSales.forEach((s) => {
      rows.push([new Date(s.soldAt).toLocaleString("th-TH"), s.serialCode, s.username, s.map, String(s.sellingPrice), String(s.cost), String(s.profit)]);
    });

    const csvContent = "\uFEFF" + rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `KaiZort_Expense_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("ส่งออกไฟล์ CSV สำหรับเปิดใน Excel เรียบร้อยแล้ว");
  };

  const summary = data?.summary || {
    grossRevenue: 0,
    productCost: 0,
    operatingExpenses: 0,
    defectLoss: 0,
    netProfit: 0,
    profitMargin: 100,
    inventoryCost: 0,
    potentialRevenue: 0,
    soldCount: 0,
    availableCount: 0,
    totalExpensesCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">
            FINANCE // PROFIT & LOSS MANAGEMENT LEDGER
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            รายงานบัญชี ต้นทุน & กำไรขาดทุน (Financial & Expense)
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            สรุปยอดขายจริง ต้นทุนไอดี ค่าใช้จ่ายร้าน (VPS/สคริปต์/ไฟ) และคำนวณกำไรสุทธิแบบ Real-time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="ดาวน์โหลดไฟล์ .CSV สำหรับเปิดใน Excel หรือ Google Sheets"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>ส่งออก Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePushDiscord}
            disabled={pushingDiscord}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="ส่งการ์ดสรุปยอดขาย-กำไร เข้าห้อง Discord"
          >
            <Send className="w-4 h-4 text-blue-400" />
            <span>{pushingDiscord ? "กำลังส่ง..." : "ส่งสรุปเข้า Discord"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddExpense(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกค่าใช้จ่ายร้าน</span>
          </button>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs font-medium flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Time Range Filter Selector */}
      <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-obsidian-900 border border-zinc-800">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-zinc-400 ml-2 mr-1" />
          <span className="text-xs font-mono text-zinc-400 uppercase hidden sm:inline">
            ช่วงเวลา:
          </span>
          {(
            [
              { id: "ALL", label: "ทั้งหมด (All Time)" },
              { id: "TODAY", label: "วันนี้" },
              { id: "YESTERDAY", label: "เมื่อวาน" },
              { id: "7D", label: "7 วันล่าสุด" },
              { id: "MONTH", label: "เดือนนี้" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeRange(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                timeRange === t.id
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-zinc-400 pr-2">
          {loading ? (
            <span className="text-amber-400 animate-pulse">กำลังคำนวณ...</span>
          ) : (
            <span>คำนวณสดจาก Supabase DB</span>
          )}
        </div>
      </div>

      {/* 5 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Gross Revenue */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
            01 // ยอดขายจริง (REVENUE)
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            {formatBaht(summary.grossRevenue)}
          </p>
          <span className="text-[11px] text-zinc-500 font-mono block">
            ขายแล้ว {summary.soldCount} บัญชี
          </span>
        </div>

        {/* Card 2: Product COGS */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
            02 // ต้นทุนไอดี (COGS)
          </span>
          <p className="text-2xl font-bold font-mono text-zinc-200 num-tabular">
            {formatBaht(summary.productCost)}
          </p>
          <span className="text-[11px] text-zinc-500 font-mono block">
            {summary.productCost === 0 ? "ฟาร์มเอง (ต้นทุน ฿0.00)" : "ต้นทุนสินค้าที่ขายแล้ว"}
          </span>
        </div>

        {/* Card 3: Operating Expenses */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block font-bold">
              03 // ค่าใช้จ่ายร้าน (EXPENSES)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {summary.totalExpensesCount} รายการ
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-amber-400 num-tabular">
            {formatBaht(summary.operatingExpenses)}
          </p>
          <span className="text-[11px] text-zinc-500 font-mono block">
            ค่าไฟ, VPS, สคริปต์ฟาร์ม ฯลฯ
          </span>
        </div>

        {/* Card 4: Net Realized Profit / Loss */}
        {(() => {
          const isLoss = summary.netProfit < 0;
          const isZero = summary.netProfit === 0;
          return (
            <div
              className={`p-4 rounded-xl space-y-1 transition-colors ${
                isLoss
                  ? "bg-rose-950/20 border border-rose-500/30"
                  : isZero
                  ? "bg-zinc-900/50 border border-zinc-800"
                  : "bg-emerald-950/20 border border-emerald-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest block font-bold ${
                    isLoss ? "text-rose-400" : isZero ? "text-zinc-300" : "text-emerald-400"
                  }`}
                >
                  {isLoss ? "04 // ขาดทุนสุทธิ (NET LOSS)" : isZero ? "04 // เท่าทุน (BREAKEVEN)" : "04 // กำไรสุทธิ (NET PROFIT)"}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    isLoss
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : isZero
                      ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {summary.profitMargin}%
                </span>
              </div>
              <p
                className={`text-2xl font-bold font-mono num-tabular ${
                  isLoss ? "text-rose-400" : isZero ? "text-zinc-300" : "text-emerald-400"
                }`}
              >
                {formatSignedBaht(summary.netProfit)}
              </p>
              <span
                className={`text-[11px] font-mono block ${
                  isLoss ? "text-rose-400/80" : isZero ? "text-zinc-500" : "text-emerald-500/80"
                }`}
              >
                {isLoss ? "รายรับน้อยกว่าต้นทุนและค่าใช้จ่ายร้าน" : "รายรับลบต้นทุนและค่าใช้จ่ายร้าน"}
              </span>
            </div>
          );
        })()}

        {/* Card 5: Inventory Valuation */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
            05 // มูลค่าสต็อกรอขาย
          </span>
          <p className="text-2xl font-bold font-mono text-blue-400 num-tabular">
            {formatBaht(summary.potentialRevenue)}
          </p>
          <span className="text-[11px] text-zinc-500 font-mono block">
            พร้อมขาย {summary.availableCount} บัญชี
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-800 gap-6 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("BREAKDOWN")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "BREAKDOWN"
              ? "border-white text-white font-bold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>กำไรแยกตามแมพ / หมวดหมู่เกม ({data?.breakdownByMap.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EXPENSES")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "EXPENSES"
              ? "border-white text-white font-bold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <span>จัดการค่าใช้จ่ายร้าน ({data?.expenses.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SALES")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "SALES"
              ? "border-white text-white font-bold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>ประวัติการขายรายไอดี ({data?.recentSales.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: Map Breakdown */}
      {activeTab === "BREAKDOWN" && (
        <div className="rounded-xl border border-zinc-800 bg-obsidian-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 font-mono uppercase text-zinc-400 text-[11px]">
                <tr>
                  <th className="py-3 px-4">แมพ / สินค้าเกม</th>
                  <th className="py-3 px-4 text-center">ขายแล้ว</th>
                  <th className="py-3 px-4 text-center">คงเหลือพร้อมขาย</th>
                  <th className="py-3 px-4 text-right">ยอดขายรวม</th>
                  <th className="py-3 px-4 text-right">ต้นทุนไอดี</th>
                  <th className="py-3 px-4 text-right">กำไรสุทธิ</th>
                  <th className="py-3 px-4 text-center">อัตรากำไร (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {!data || data.breakdownByMap.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-zinc-500 font-mono">
                      ไม่พบข้อมูลบัญชีในช่วงเวลาที่เลือก
                    </td>
                  </tr>
                ) : (
                  data.breakdownByMap.map((mapItem) => {
                    const margin =
                      mapItem.revenue > 0
                        ? ((mapItem.profit / mapItem.revenue) * 100).toFixed(0)
                        : "0";
                    return (
                      <tr key={mapItem.mapName} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                          <span>🗺️</span>
                          <span className="font-semibold">{mapItem.mapName}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono num-tabular">
                          <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-white font-bold">
                            {mapItem.soldCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono num-tabular">
                          <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold">
                            {mapItem.availableCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-white num-tabular font-medium">
                          {formatBaht(mapItem.revenue)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-zinc-400 num-tabular">
                          {formatBaht(mapItem.cost)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono font-bold num-tabular ${
                            mapItem.profit < 0
                              ? "text-rose-400"
                              : mapItem.profit === 0
                              ? "text-zinc-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {formatSignedBaht(mapItem.profit)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              mapItem.profit < 0
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : mapItem.profit === 0
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Operating Expenses */}
      {activeTab === "EXPENSES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                รายการค่าใช้จ่ายคงที่ของร้าน (Operating Expenses)
              </h3>
              <p className="text-xs text-zinc-400">
                บันทึกค่าใช้จ่าย เช่น ค่าไฟฟาร์ม, ค่า VPS, ค่าสคริปต์รายเดือน เพื่อนำมาหักลบจากกำไรสุทธิแท้จริง
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddExpense(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มค่าใช้จ่าย</span>
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-obsidian-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 border-b border-zinc-800 font-mono uppercase text-zinc-400 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">วันที่จ่าย</th>
                    <th className="py-3 px-4">รายการค่าใช้จ่าย</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4 text-right">จำนวนเงิน</th>
                    <th className="py-3 px-4">หมายเหตุ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {!data || data.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-zinc-500 font-mono">
                        ยังไม่มีการบันทึกค่าใช้จ่ายร้าน (กดปุ่ม &quot;เพิ่มค่าใช้จ่าย&quot; เพื่อเริ่มต้น)
                      </td>
                    </tr>
                  ) : (
                    data.expenses.map((exp) => {
                      const cat = expenseCategories[exp.category] || expenseCategories.OTHER;
                      return (
                        <tr key={exp.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-zinc-400">
                            {new Date(exp.paidAt).toLocaleDateString("th-TH")}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-white">
                            {exp.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                              <span>{cat.icon}</span>
                              <span>{cat.label}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 num-tabular">
                            {formatBaht(exp.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400 max-w-xs truncate">
                            {exp.note || "-"}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id, exp.title)}
                              className="p-1.5 rounded hover:bg-red-950/50 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
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
          </div>
        </div>
      )}

      {/* TAB 3: Recent Sales Ledger */}
      {activeTab === "SALES" && (
        <div className="rounded-xl border border-zinc-800 bg-obsidian-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 font-mono uppercase text-zinc-400 text-[11px]">
                <tr>
                  <th className="py-3 px-4">SERIAL & ชื่อไอดี</th>
                  <th className="py-3 px-4">สินค้า / แมพ</th>
                  <th className="py-3 px-4 text-right">ราคาขาย</th>
                  <th className="py-3 px-4 text-right">ต้นทุน</th>
                  <th className="py-3 px-4 text-right">กำไรต่อไอดี</th>
                  <th className="py-3 px-4 text-right">เวลาขาย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {!data || data.recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-500 font-mono">
                      ไม่พบประวัติการขายในช่วงเวลาที่เลือก
                    </td>
                  </tr>
                ) : (
                  data.recentSales.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-white font-bold block">{item.username}</span>
                        <span className="text-[11px] text-zinc-500 block">{item.serialCode}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-white font-medium block">{item.productTitle}</span>
                        <span className="text-[10px] font-mono text-blue-400 block mt-0.5">
                          🗺️ {item.map}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-white num-tabular font-semibold">
                        {formatBaht(item.sellingPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-400 num-tabular">
                        {formatBaht(item.cost)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold num-tabular ${
                          item.profit < 0
                            ? "text-rose-400"
                            : item.profit === 0
                            ? "text-zinc-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {formatSignedBaht(item.profit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-400 num-tabular">
                        {new Date(item.soldAt).toLocaleString("th-TH")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Expense */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-obsidian-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">บันทึกค่าใช้จ่ายร้าน</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpense(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  ชื่อรายการค่าใช้จ่าย *
                </label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="เช่น ค่าสคริปต์ฟาร์มประจำเดือน, ค่าไฟฟาร์ม, ค่า VPS"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    หมวดหมู่ค่าใช้จ่าย
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white focus:outline-none"
                  >
                    {Object.entries(expenseCategories).map(([key, info]) => (
                      <option key={key} value={key} className="bg-obsidian-950 text-white">
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    จำนวนเงิน (THB) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="เช่น 150"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white font-mono num-tabular focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  rows={2}
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="เช่น ซื้อจากร้าน Dev XYZ รอบ 20 ต.ค."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-md p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingExpense ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
