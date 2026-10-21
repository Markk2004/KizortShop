"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Package,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Wallet,
} from "lucide-react";
import { formatBaht, formatSignedBaht } from "@/lib/format";
import {
  OrderDetailDrawer,
  type OrderDrawerData,
} from "@/features/admin/components/OrderDetailDrawer";
import {
  AdminSmartFilterBar,
  verifySearchInput,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";
import {
  fetchDashboardMetrics,
  fetchAccountingData,
  type DashboardMetrics,
  type AccountingData,
} from "@/features/admin/services/admin-api";

type TimeRange = "TODAY" | "7D" | "MONTH" | "CUSTOM";

interface DailyBar {
  day: string;
  label: string;
  val: number;
  valLabel: string;
  heightPercent: number;
  isToday?: boolean;
}

const weeklyBars: DailyBar[] = [
  { day: "จ.", label: "วันจันทร์", val: 36200, valLabel: "36.2K", heightPercent: 72 },
  { day: "อ.", label: "วันอังคาร", val: 41500, valLabel: "41.5K", heightPercent: 83 },
  { day: "พ.", label: "วันพุธ", val: 38900, valLabel: "38.9K", heightPercent: 78 },
  { day: "พฤ.", label: "วันพฤหัสบดี", val: 34100, valLabel: "34.1K", heightPercent: 68 },
  { day: "ศ.", label: "วันศุกร์", val: 44730, valLabel: "44.7K", heightPercent: 89 },
  { day: "ส.", label: "วันเสาร์", val: 40820, valLabel: "40.8K", heightPercent: 81 },
  { day: "อา.", label: "วันอาทิตย์", val: 48250, valLabel: "48.2K", heightPercent: 96, isToday: true },
];

const bestSellers = [
  { code: "BF-V4", name: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น", units: 36, rev: 12564, width: "100%" },
  { code: "BF-CDK", name: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ", units: 21, rev: 10290, width: "82%" },
  { code: "AD-MYT", name: "Anime Defenders Unit Mythic ลิมิเต็ด อัปเกรดดาวเต็ม", units: 33, rev: 6237, width: "50%" },
  { code: "BF-RND", name: "กล่องสุ่มไก่ตัน 6 หมัด เลเวลตัน 2550 ลุ้นดาบคู่โอเด้ง", units: 52, rev: 2028, width: "16%" },
];

const initialOrders: OrderDrawerData[] = [
  {
    id: "ord_101",
    orderNumber: "KZ-99412",
    buyer: "player_99",
    buyerEmail: "player99@roblox.in.th",
    productTitle: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น",
    categoryCode: "BF-V4",
    deliveredCode: "STK-BFV4-261018-0001",
    decryptedCredential: "bf_cyborg99:P@ssword2026",
    amount: 349,
    status: "COMPLETED",
    sla: "0.8 วิ",
    timeAgo: "2 นาทีที่แล้ว",
    warrantyExpiresIn: "เหลือ 23 ชม. 58 นาที",
  },
  {
    id: "ord_102",
    orderNumber: "KZ-99411",
    buyer: "zoro_fan",
    buyerEmail: "zoro@grandline.io",
    productTitle: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ",
    categoryCode: "BF-CDK",
    deliveredCode: "STK-BFCDK-261018-0004",
    decryptedCredential: "cdk_hunter02:DualSword$22",
    amount: 490,
    status: "COMPLETED",
    sla: "0.7 วิ",
    timeAgo: "14 นาทีที่แล้ว",
    warrantyExpiresIn: "เหลือ 23 ชม. 46 นาที",
  },
  {
    id: "ord_103",
    orderNumber: "KZ-99410",
    buyer: "shadow_gamer",
    buyerEmail: "shadow@kaizort.gg",
    productTitle: "Anime Defenders Unit Mythic ลิมิเต็ด อัปเกรดดาวเต็ม",
    categoryCode: "AD-MYT",
    deliveredCode: "STK-UNQAD-261017-0010",
    decryptedCredential: "ad_mythic_star:DefenderPro#1:2FA-9001",
    amount: 189,
    status: "COMPLETED",
    sla: "0.9 วิ",
    timeAgo: "28 นาทีที่แล้ว",
    warrantyExpiresIn: "เหลือ 23 ชม. 32 นาที",
  },
  {
    id: "ord_104",
    orderNumber: "KZ-99409",
    buyer: "kaizort_vip",
    buyerEmail: "vip@kaizort.store",
    productTitle: "ไอดีสุ่มไก่ตัน 6 หมัด เลเวลตัน 2550 การันตีดาบโซโล",
    categoryCode: "BF-RND",
    deliveredCode: "STK-BFRND-261017-0013",
    decryptedCredential: "rnd_box_093:RandomLuck@3",
    amount: 39,
    status: "COMPLETED",
    sla: "0.6 วิ",
    timeAgo: "42 นาทีที่แล้ว",
    warrantyExpiresIn: "เหลือ 23 ชม. 18 นาที",
  },
];

const telemetrySystems = [
  { name: "บอท Discord ส่งรหัส DM", note: "เชื่อมต่อแล้ว 0.8 วิ", status: "OK" },
  { name: "รับชำระเงิน PromptPay QR", note: "ปกติ (SlipOK API)", status: "OK" },
  { name: "ระบบส่งมอบรหัสอัตโนมัติ (FIFO)", note: "ปกติ 99.8% อัตราสำเร็จ", status: "OK" },
  { name: "คลังรหัสสต็อกเข้ารหัส AES-256-GCM", note: "ปกติ (SHA-256 Lock)", status: "OK" },
];

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<OrderDrawerData[]>(initialOrders);
  const [timeRange, setTimeRange] = useState<TimeRange>("TODAY");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [selectedOrder, setSelectedOrder] = useState<OrderDrawerData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [accounting, setAccounting] = useState<AccountingData | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    dailyRevenue: 48250,
    monthlyRevenue: 1245000,
    totalOrdersToday: 142,
    pendingSlips: 3,
    activeMembers: 1284,
    outOfStockCount: 4,
  });

  useEffect(() => {
    let isMounted = true;
    fetchDashboardMetrics().then((res) => {
      if (isMounted && res) {
        setMetrics(res);
      }
    });
    fetchAccountingData().then((res) => {
      if (isMounted && res) {
        setAccounting(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const verification = verifySearchInput(searchQuery, searchMode);

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (!verification.isValid) return false;

    if (searchMode === "ORDER_ID") {
      return o.orderNumber.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    }
    if (searchMode === "SKU_CODE") {
      return (
        o.categoryCode.toLowerCase().includes(q) ||
        o.deliveredCode.toLowerCase().includes(q)
      );
    }
    if (searchMode === "USERNAME") {
      return o.buyer.toLowerCase().includes(q);
    }
    if (searchMode === "NUMBER_PRICE") {
      return String(o.amount).includes(q);
    }

    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.buyer.toLowerCase().includes(q) ||
      o.productTitle.toLowerCase().includes(q) ||
      o.categoryCode.toLowerCase().includes(q) ||
      String(o.amount).includes(q)
    );
  });

  const handleToggleRefund = (target: OrderDrawerData) => {
    const nextStatus = target.status === "REFUNDED" ? "COMPLETED" : "REFUNDED";
    setOrders((prev) =>
      prev.map((o) => (o.id === target.id ? { ...o, status: nextStatus } : o)),
    );
    setSelectedOrder((prev) =>
      prev && prev.id === target.id ? { ...prev, status: nextStatus } : prev,
    );
    showNotification(`อัปเดตออเดอร์ #${target.orderNumber} เป็น ${nextStatus}`);
  };

  const handleReplaceStock = (target: OrderDrawerData) => {
    const newSerial = `STK-${target.categoryCode.replace("-", "")}-CLAIM-${Math.floor(
      100 + Math.random() * 900,
    )}`;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === target.id ? { ...o, deliveredCode: newSerial } : o,
      ),
    );
    setSelectedOrder((prev) =>
      prev && prev.id === target.id
        ? { ...prev, deliveredCode: newSerial }
        : prev,
    );
    showNotification(
      `สลับรหัสเคลมใหม่ (${newSerial}) ให้ออเดอร์ #${target.orderNumber} เรียบร้อย`,
    );
  };

  return (
    <div className="space-y-6">
      {/* SMART FILTER & INPUT VERIFIER BAR */}
      <AdminSmartFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        placeholder="ค้นหาออเดอร์ล่าสุด, ผู้ซื้อ, รหัส SKU หรือราคา..."
        totalMatched={filteredOrders.length}
        totalAll={orders.length}
      >
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
          {(
            [
              { id: "TODAY", label: "วันนี้" },
              { id: "7D", label: "7 วัน" },
              { id: "MONTH", label: "เดือนนี้" },
              { id: "CUSTOM", label: "กำหนดเอง" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTimeRange(t.id);
                showNotification(`สลับช่วงเวลาแสดงผล: ${t.label}`);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                timeRange === t.id
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </AdminSmartFilterBar>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* GREETING & PRIMARY ACTIONS */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-zinc-800">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            วันอาทิตย์ที่ 18 ตุลาคม 2569 // 23:45 น.
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            สวัสดีตอนค่ำ คุณไค (KaiZort Operations)
          </h1>
          <p className="text-sm text-zinc-300">
            วันนี้ร้านขายได้ดีกว่าเมื่อวาน และมี{" "}
            <strong className="text-emerald-400 font-mono">8 งาน</strong> รอดำเนินการในระบบ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/stocks"
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Boxes className="w-4 h-4" />
            <span>เติมสต็อกรหัสเกม</span>
          </Link>

          <Link
            href="/admin/products"
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-200 bg-obsidian-900 hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Package className="w-4 h-4 text-zinc-400" />
            <span>เพิ่มสินค้าใหม่</span>
          </Link>
        </div>
      </section>

      {/* HERO: REVENUE 7-DAY BAR CHART + TODO ACTION LIST */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* REVENUE 7-DAY BAR CHART (7 Cols) */}
        <div className="lg:col-span-7 rounded-xl border border-zinc-800 bg-obsidian-900 p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                01 // TODAY REVENUE
              </span>
              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight num-tabular">
                  {formatBaht(metrics.dailyRevenue)}
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-400 block">
                เมื่อวาน ฿40,820.00
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+18.2% จากเมื่อวาน</span>
            </span>
          </div>

          {/* 7 Days Bar Chart */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">
                สถิติยอดขาย 7 วันล่าสุด
              </span>
              <span className="text-xs font-mono text-zinc-400">
                MAX: ฿50,000 / DAY
              </span>
            </div>

            <div className="h-44 flex items-end gap-2 sm:gap-3 pb-2 border-b border-zinc-800">
              {weeklyBars.map((b) => (
                <div
                  key={b.day}
                  title={`${b.label}: ${formatBaht(b.val)}`}
                  className="flex-1 flex flex-col items-center justify-end gap-2 h-full group"
                >
                  <span
                    className={`text-xs font-mono num-tabular transition-colors ${
                      b.isToday
                        ? "text-white font-bold"
                        : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  >
                    {b.valLabel}
                  </span>
                  <div className="w-full bg-zinc-950 border border-zinc-800 rounded-t-sm h-full flex items-end p-0.5">
                    <div
                      style={{ height: `${b.heightPercent}%` }}
                      className={`w-full rounded-t-xs transition-all ${
                        b.isToday
                          ? "bg-white"
                          : "bg-zinc-700 group-hover:bg-zinc-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 sm:gap-3 text-center">
              {weeklyBars.map((b) => (
                <span
                  key={b.day}
                  className={`flex-1 text-xs font-mono ${
                    b.isToday ? "text-white font-bold" : "text-zinc-400"
                  }`}
                >
                  {b.day}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* TODO ACTION QUEUE (5 Cols) */}
        <div className="lg:col-span-5 rounded-xl border border-zinc-800 bg-obsidian-900 p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                ต้องทำตอนนี้ (Priority Queue)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              8 รอดำเนินการ
            </span>
          </div>

          <div className="space-y-3">
            {/* Task 1 */}
            <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">
                    สลิปโอนเงินรอตรวจ {metrics.pendingSlips} รายการ
                  </span>
                  <span className="text-xs font-mono text-zinc-400 block">
                    รวม ฿1,150.00 · ผ่าน PromptPay
                  </span>
                </div>
              </div>

              <Link
                href="/admin/topups"
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>ตรวจสลิป</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Task 2 */}
            <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">
                    สินค้าใกล้หมดสต็อก {metrics.outOfStockCount} หมวด
                  </span>
                  <span className="text-xs font-mono text-zinc-400 block">
                    BF-CDK, ROBUX-AUTO และอีก 2 รายการ
                  </span>
                </div>
              </div>

              <Link
                href="/admin/stocks"
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>เติมสต็อก</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Task 3 */}
            <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">
                    เคลมสินค้าในประกัน 1 รายการ
                  </span>
                  <span className="text-xs font-mono text-zinc-400 block">
                    ต้องตอบภายใน 24 ชม. · เหลือ 21 ชม.
                  </span>
                </div>
              </div>

              <Link
                href="/admin/stocks"
                className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>ดูเคลม</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* KPI ROW: 3 Columns */}
      <section aria-label="ตัวเลขสำคัญ" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-obsidian-900 p-5 space-y-2">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-widest block">
            01 // 7-DAY REVENUE
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            ฿284,500.00
          </p>
          <div className="h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: "94.8%" }} />
          </div>
          <span className="text-xs text-zinc-400 block font-mono">
            ทำได้ 94.8% ของเป้า ฿300,000
          </span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-obsidian-900 p-5 space-y-2">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-widest block">
            02 // ORDERS TODAY
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            142 <span className="text-sm font-normal text-zinc-400 font-sans">รายการ</span>
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 pt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>ส่งรหัสอัตโนมัติสำเร็จ 99.8%</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-obsidian-900 p-5 space-y-2">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-widest block">
            03 // VAULT INVENTORY
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            1,284 <span className="text-sm font-normal text-zinc-400 font-sans">ไอดีพร้อมขาย</span>
          </p>
          <Link
            href="/admin/stocks"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            <span>ใกล้หมด 4 รายการ · ดูรายการสต็อก</span>
          </Link>
        </div>
      </section>

      {/* REAL-TIME COST & PROFIT ACCOUNTING (ระบบบัญชี ต้นทุน - กำไร - ขาดทุน) */}
      <section className="rounded-xl border border-zinc-800 bg-obsidian-900 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                ระบบบัญชีการเงิน: ยอดขาย ต้นทุน และกำไรสุทธิ (Real-Time Cost & Profit Ledger)
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              คำนวณจากยอดขายจริง ต้นทุนรับเข้า (COGS) และมูลค่าสินค้าคงคลังใน Supabase Database อัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">สถานะสต็อก:</span>
            <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-400 font-bold">
              ขายแล้ว {accounting?.summary.soldCount ?? 0} / พร้อมขาย {accounting?.summary.availableCount ?? 0}
            </span>
          </div>
        </div>

        {/* 4 Financial Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Revenue */}
          <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
              01 // ยอดขายจริงรวม (TOTAL REVENUE)
            </span>
            <p className="text-2xl font-bold font-mono text-white num-tabular">
              {formatBaht(accounting?.summary.totalRevenue ?? 0)}
            </p>
            <span className="text-[11px] text-zinc-500 font-mono block">
              จากไอดีที่ขายออกแล้ว {accounting?.summary.soldCount ?? 0} บัญชี
            </span>
          </div>

          {/* Card 2: Total Cost */}
          <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
              02 // ต้นทุนสินค้ารวม (TOTAL COGS)
            </span>
            <p className="text-2xl font-bold font-mono text-zinc-200 num-tabular">
              {formatBaht(accounting?.summary.totalCost ?? 0)}
            </p>
            <span className="text-[11px] text-zinc-500 font-mono block">
              {accounting?.summary.totalCost === 0
                ? "ทำเอง/ฟาร์มเอง (ต้นทุน ฿0.00)"
                : "ต้นทุนสินค้าที่ขายแล้ว"}
            </span>
          </div>

          {/* Card 3: Net Profit / Loss */}
          {(() => {
            const netProfit = accounting?.summary.netProfit ?? 0;
            const margin = accounting?.summary.profitMargin ?? 100;
            const isLoss = netProfit < 0;
            const isZero = netProfit === 0;
            return (
              <div
                className={`p-4 rounded-lg space-y-1 transition-colors ${
                  isLoss
                    ? "bg-rose-950/20 border border-rose-500/30"
                    : isZero
                    ? "bg-zinc-950/80 border border-zinc-800/80"
                    : "bg-emerald-950/20 border border-emerald-500/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest block font-bold ${
                      isLoss ? "text-rose-400" : isZero ? "text-zinc-300" : "text-emerald-400"
                    }`}
                  >
                    {isLoss ? "03 // ขาดทุนสุทธิ (NET LOSS)" : isZero ? "03 // เท่าทุน (BREAKEVEN)" : "03 // กำไรสุทธิ (NET PROFIT)"}
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
                    {margin}% MARGIN
                  </span>
                </div>
                <p
                  className={`text-2xl font-bold font-mono num-tabular ${
                    isLoss ? "text-rose-400" : isZero ? "text-zinc-300" : "text-emerald-400"
                  }`}
                >
                  {formatSignedBaht(netProfit)}
                </p>
                <span
                  className={`text-[11px] font-mono block ${
                    isLoss ? "text-rose-400/80" : isZero ? "text-zinc-500" : "text-emerald-500/80"
                  }`}
                >
                  {isLoss ? "รายรับน้อยกว่าต้นทุนและค่าใช้จ่ายร้าน" : "กำไรสุทธิหลังหักต้นทุนทุกรายการ"}
                </span>
              </div>
            );
          })()}

          {/* Card 4: Inventory Valuation */}
          <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
              04 // มูลค่าสต็อกคงเหลือ (INVENTORY VALUE)
            </span>
            <p className="text-2xl font-bold font-mono text-blue-400 num-tabular">
              {formatBaht(accounting?.summary.potentialRevenue ?? 0)}
            </p>
            <span className="text-[11px] text-zinc-500 font-mono block">
              พร้อมขาย {accounting?.summary.availableCount ?? 0} บัญชี (ต้นทุนคงค้าง{" "}
              {formatBaht(accounting?.summary.inventoryCost ?? 0)})
            </span>
          </div>
        </div>

        {/* Breakdown by Map Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
              📊 สรุปยอดขาย ต้นทุน และกำไร แยกตามแมพ / หมวดหมู่เกม
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">
              {accounting?.breakdownByMap.length ?? 0} หมวดหมู่
            </span>
          </div>

          <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950/60">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 border-b border-zinc-800 font-mono uppercase text-zinc-400 text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">แมพ / สินค้า</th>
                  <th className="py-2.5 px-4 text-center">ขายแล้ว</th>
                  <th className="py-2.5 px-4 text-center">คงเหลือ</th>
                  <th className="py-2.5 px-4 text-right">ยอดขายรวม</th>
                  <th className="py-2.5 px-4 text-right">ต้นทุนรวม</th>
                  <th className="py-2.5 px-4 text-right">กำไรสุทธิ</th>
                  <th className="py-2.5 px-4 text-center">อัตรากำไร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {!accounting || accounting.breakdownByMap.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500 font-mono">
                      ยังไม่มีรายการบัญชีในระบบ
                    </td>
                  </tr>
                ) : (
                  accounting.breakdownByMap.map((mapItem) => {
                    const margin =
                      mapItem.revenue > 0
                        ? ((mapItem.profit / mapItem.revenue) * 100).toFixed(0)
                        : "0";
                    return (
                      <tr key={mapItem.mapName} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-white flex items-center gap-1.5">
                          <span>🗺️</span>
                          <span>{mapItem.mapName}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono num-tabular">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-white">
                            {mapItem.soldCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono num-tabular">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
                            {mapItem.availableCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white num-tabular">
                          {formatBaht(mapItem.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400 num-tabular">
                          {formatBaht(mapItem.cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 num-tabular">
                          +{formatBaht(mapItem.profit)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
      </section>

      {/* LEDGER + SIDEBAR COLUMN */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 8 COLS: Recent Orders Ledger with Clickable Drawer */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-800 bg-obsidian-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                คำสั่งซื้อล่าสุด (คลิกที่รายการหรือปุ่ม &ldquo;ดู&rdquo; เพื่อเปิด Drawer)
              </h2>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>ดูทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[680px] divide-y divide-zinc-800/70">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">
                  ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไขการค้นหา
                </div>
              ) : (
                filteredOrders.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedOrder(r)}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-zinc-800/35 transition-colors cursor-pointer"
                  >
                    {/* Item Details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <span className="text-sm font-semibold text-white block truncate">
                        {r.productTitle}
                      </span>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-zinc-400">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-bold">
                          {r.categoryCode}
                        </span>
                        <span className="text-white font-bold">#{r.orderNumber}</span>
                        <span>@{r.buyer}</span>
                        <span>· {r.timeAgo}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="w-28 text-right font-mono font-bold text-base text-white num-tabular">
                      {formatBaht(r.amount)}
                    </div>

                    {/* SLA Badge */}
                    <div className="w-28 text-center">
                      {r.status === "REFUNDED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-mono font-semibold">
                          REFUNDED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ส่งแล้ว {r.sla}</span>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div
                      className="w-36 flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          showNotification(`ส่งรหัสของ ${r.orderNumber} ซ้ำเข้า DM สำเร็จ`)
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
                      >
                        ส่งซ้ำ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดู</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 4 COLS: Top Products + Telemetry */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-obsidian-900 p-5 space-y-4">
            <div className="space-y-0.5 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white tracking-wide">
                  สินค้าขายดีวันนี้
                </h2>
              </div>
              <span className="text-xs font-mono text-zinc-400 block">
                เรียงตามยอดขายสะสม
              </span>
            </div>

            <div className="space-y-3.5">
              {bestSellers.map((t) => (
                <div key={t.code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-bold text-xs">
                        {t.code}
                      </span>
                      <span className="text-zinc-300 text-xs">{t.units} ชิ้น</span>
                    </div>
                    <span className="font-bold text-white num-tabular">
                      {formatBaht(t.rev)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: t.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-obsidian-900 p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white tracking-wide">
                สถานะระบบ (Telemetry)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ทำงานปกติ
              </span>
            </div>

            <div className="divide-y divide-zinc-800/70 text-sm">
              {telemetrySystems.map((s) => (
                <div
                  key={s.name}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-zinc-200 truncate">{s.name}</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 shrink-0">
                    {s.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ORDER DETAIL DRAWER */}
      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onResendDm={(ord) =>
          showNotification(`ส่งรหัสออเดอร์ #${ord.orderNumber} ซ้ำเข้า Discord DM สำเร็จ`)
        }
        onToggleRefund={handleToggleRefund}
        onReplaceStock={handleReplaceStock}
      />
    </div>
  );
}
