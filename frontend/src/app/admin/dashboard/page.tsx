import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CreditCard,
  Package,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { formatBaht } from "@/lib/format";

interface RecentOrderRow {
  id: string;
  orderNumber: string;
  buyer: string;
  productTitle: string;
  amount: number;
  status: "COMPLETED" | "PENDING";
  deliveryTime: string;
  timeAgo: string;
}

const recentOrders: RecentOrderRow[] = [
  {
    id: "ord_101",
    orderNumber: "ORD-99412",
    buyer: "player_99",
    productTitle: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น",
    amount: 349,
    status: "COMPLETED",
    deliveryTime: "0.8s",
    timeAgo: "2 นาทีที่แล้ว",
  },
  {
    id: "ord_102",
    orderNumber: "ORD-99411",
    buyer: "zoro_fan",
    productTitle: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณ",
    amount: 490,
    status: "COMPLETED",
    deliveryTime: "0.7s",
    timeAgo: "14 นาทีที่แล้ว",
  },
  {
    id: "ord_103",
    orderNumber: "ORD-99410",
    buyer: "shadow_gamer",
    productTitle: "Anime Defenders Unit Mythic ลิมิเต็ด อัปเกรดดาวเต็ม",
    amount: 189,
    status: "COMPLETED",
    deliveryTime: "0.9s",
    timeAgo: "28 นาทีที่แล้ว",
  },
  {
    id: "ord_104",
    orderNumber: "ORD-99409",
    buyer: "kaitanking",
    productTitle: "ไอดีสุ่มไก่ตัน 6 หมัด เลเวลตัน 2550 การันตีดาบโซโล",
    amount: 39,
    status: "COMPLETED",
    deliveryTime: "0.6s",
    timeAgo: "42 นาทีที่แล้ว",
  },
  {
    id: "ord_105",
    orderNumber: "ORD-99408",
    buyer: "bloxfruits_king",
    productTitle: "ไก่ตัน Blox Fruits หมัด Godhuman + สมอ Shark Anchor",
    amount: 99,
    status: "COMPLETED",
    deliveryTime: "0.8s",
    timeAgo: "1 ชม. ที่แล้ว",
  },
];

const weeklySparkline = [
  { day: "จันทร์", value: 34200, height: "55%" },
  { day: "อังคาร", value: 38900, height: "65%" },
  { day: "พุธ", value: 41200, height: "72%" },
  { day: "พฤหัส", value: 36500, height: "60%" },
  { day: "ศุกร์", value: 52400, height: "92%" },
  { day: "เสาร์", value: 58000, height: "100%" },
  { day: "อาทิตย์", value: 48250, height: "85%", isToday: true },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header & Quick Action Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[11px] font-mono font-semibold tracking-wider text-blue-400 uppercase">
              ADMIN CONTROL CENTER
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            แดชบอร์ดภาพรวมระบบ
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            สรุปข้อมูลสถิติยอดขาย ธุรกรรมการเงิน และสถานะสต็อกสินค้าแบบเรียลไทม์
          </p>
        </div>

        {/* Quick Action Pills Toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Link
            href="/admin/stocks"
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Boxes className="w-3.5 h-3.5 text-blue-400" />
            <span>+ เติมสต็อกรหัส</span>
          </Link>

          <Link
            href="/admin/products"
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ เพิ่มสินค้า</span>
          </Link>

          <Link
            href="/admin/topups"
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
            <span>ตรวจสลิป</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 ml-0.5">
              3
            </span>
          </Link>

          <Link
            href="/admin/users"
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>จัดการสมาชิก</span>
          </Link>
        </div>
      </div>

      {/* Main Bento Grid: 8 Cols Left (Stats + Feed) / 4 Cols Right (Actions + Pulse) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 8 COLS */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bento Block 1: Hero Revenue & Performance Card */}
          <section className="luxury-card rounded-2xl p-6 sm:p-7 border border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-slate-400 block mb-1">
                  ยอดขายรวมประจำวันนี้ (Today&apos;s Revenue)
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight num-tabular">
                    {formatBaht(48250)}
                  </span>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>+18.2%</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  เทียบกับช่วงเวลาเดียวกันเมื่อวาน (฿40,820)
                </span>
              </div>

              {/* Weekly Sparkline Rhythm */}
              <div className="space-y-2">
                <span className="text-[11px] text-slate-500 block text-right font-medium">
                  แนวโน้ม 7 วันย้อนหลัง
                </span>
                <div className="flex items-end gap-2 h-14 pt-1">
                  {weeklySparkline.map((item) => (
                    <div
                      key={item.day}
                      title={`${item.day}: ${formatBaht(item.value)}`}
                      className="flex flex-col items-center gap-1.5 group cursor-default"
                    >
                      <div className="w-4 sm:w-5 bg-white/[0.06] rounded-t-sm h-12 flex items-end overflow-hidden">
                        <div
                          style={{ height: item.height }}
                          className={`w-full transition-all rounded-t-sm ${
                            item.isToday
                              ? "bg-blue-500 group-hover:bg-blue-400"
                              : "bg-white/20 group-hover:bg-white/40"
                          }`}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase">
                        {item.day.slice(0, 1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sub Metrics Row - Clean Dividers, No Nested Heavy Boxes */}
            <div className="pt-5 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  ยอดรวมสัปดาห์นี้
                </span>
                <p className="text-base sm:text-lg font-bold text-white num-tabular mt-0.5">
                  {formatBaht(284500)}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  คำสั่งซื้อวันนี้
                </span>
                <p className="text-base sm:text-lg font-bold text-white num-tabular mt-0.5">
                  142 รายการ
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  ส่งมอบอัตโนมัติสำเร็จ
                </span>
                <p className="text-base sm:text-lg font-bold text-emerald-400 num-tabular mt-0.5">
                  99.8%
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  ความเร็วส่งมอบเฉลี่ย
                </span>
                <p className="text-base sm:text-lg font-bold text-slate-200 num-tabular mt-0.5">
                  0.8 วินาที
                </p>
              </div>
            </div>
          </section>

          {/* Bento Block 2: Live Recent Orders Stream */}
          <section className="luxury-card rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  ฟีดคำสั่งซื้อล่าสุด (Live Orders Stream)
                </h2>
              </div>

              <Link
                href="/admin/orders"
                className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                <span>ดูประวัติทั้งหมด</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-white/[0.02] px-2 -mx-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-xs font-mono font-semibold text-slate-300 shrink-0 mt-0.5 sm:mt-0">
                      ID
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                          {order.productTitle}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                          ({order.orderNumber})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-300">{order.buyer}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-500">{order.timeAgo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-11 sm:pl-0">
                    <span className="text-xs font-bold text-white num-tabular">
                      {formatBaht(order.amount)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{order.deliveryTime}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: 4 COLS */}
        <div className="lg:col-span-4 space-y-6">
          {/* Bento Block 3: Action Required Items (งานด่วนที่ต้องทำ) */}
          <section className="luxury-card rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white tracking-wide">
                งานที่ต้องดำเนินการ (Action Items)
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                7 รายการ
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Item 1: Pending Slips */}
              <Link
                href="/admin/topups"
                className="p-3.5 rounded-xl bg-obsidian-900 border border-white/[0.06] hover:border-white/15 transition-all flex items-center justify-between block group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      สลิปรอตรวจสอบ
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    ยอดรวม ฿1,150.00 (PromptPay)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-400 num-tabular">
                    3
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </Link>

              {/* Item 2: Low Stock Alert */}
              <Link
                href="/admin/stocks"
                className="p-3.5 rounded-xl bg-obsidian-900 border border-white/[0.06] hover:border-white/15 transition-all flex items-center justify-between block group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      สินค้าใกล้หมดสต็อก
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Blox Fruits CDK, Robux Auto
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/15 text-red-400 num-tabular">
                    4
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </Link>

              {/* Item 3: Claim Tickets */}
              <Link
                href="/support"
                className="p-3.5 rounded-xl bg-obsidian-900 border border-white/[0.06] hover:border-white/15 transition-all flex items-center justify-between block group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      ทิกเก็ตแจ้งปัญหาเคลม
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    รอทีมงานติดต่อกลับ 1 เคส
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/15 text-blue-400 num-tabular">
                    1
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </Link>
            </div>
          </section>

          {/* Bento Block 4: Automation & System Pulse */}
          <section className="luxury-card rounded-2xl p-5 sm:p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  สถานะระบบอัตโนมัติ 24/7
                </h2>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">ALL SYSTEMS NOMINAL</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>บอทส่งมอบรหัสเกม</span>
                </span>
                <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                  0.8s
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-white/[0.04]">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>เกตเวย์ตรวจสลิป PromptPay</span>
                </span>
                <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                  ONLINE
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-white/[0.04]">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>ฐานข้อมูล PostgreSQL Prisma</span>
                </span>
                <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                  4ms
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-white/[0.04]">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>สำรองข้อมูลอัตโนมัติ</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  04:00 น.
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
