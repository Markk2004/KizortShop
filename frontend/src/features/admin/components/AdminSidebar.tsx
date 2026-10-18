"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Clock,
  CreditCard,
  LayoutDashboard,
  Package,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

const adminNav = [
  { label: "ภาพรวมระบบ", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "จัดการสินค้า", href: "/admin/products", icon: Package },
  { label: "คลังสต็อกรหัสเกม", href: "/admin/stocks", icon: Boxes },
  { label: "คำสั่งซื้อทั้งหมด", href: "/admin/orders", icon: Clock },
  { label: "ตรวจสอบการเติมเงิน", href: "/admin/topups", icon: CreditCard },
  { label: "จัดการสมาชิก", href: "/admin/users", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-obsidian-950 border-r border-white/[0.08] flex flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/[0.08]">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight block">
              KAITAN ADMIN
            </span>
            <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest block">
              MANAGEMENT PORTAL
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            ระบบจัดการหลัก
          </p>
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors",
                  isActive
                    ? "bg-white/[0.08] text-white border border-white/[0.1] font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]",
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-red-400" : "text-slate-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Return to Storefront */}
      <div className="p-4 border-t border-white/[0.08] bg-obsidian-900/40">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับไปยังหน้าร้านค้า</span>
        </Link>
      </div>
    </aside>
  );
}
