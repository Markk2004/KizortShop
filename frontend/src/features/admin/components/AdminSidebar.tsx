"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Clock,
  CreditCard,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "default" | "amber" | "red" | "emerald";
}

interface AdminNavSection {
  sectionKey: string;
  title: string;
  items: AdminNavItem[];
}

const adminNavSections: AdminNavSection[] = [
  {
    sectionKey: "OVERVIEW",
    title: "ภาพรวม & ปฏิบัติการ // 01",
    items: [
      {
        label: "ภาพรวมระบบ",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "คำสั่งซื้อทั้งหมด",
        href: "/admin/orders",
        icon: Clock,
        badge: "142",
        badgeVariant: "default",
      },
    ],
  },
  {
    sectionKey: "FINANCE",
    title: "การเงิน & ชำระเงิน // 02",
    items: [
      {
        label: "บันทึกค่าใช้จ่าย & กำไรขาดทุน",
        href: "/admin/expense",
        icon: Receipt,
        badge: "Real-time",
        badgeVariant: "emerald",
      },
      {
        label: "ตรวจสอบการเติมเงิน",
        href: "/admin/topups",
        icon: CreditCard,
        badge: "03 รอตรวจ",
        badgeVariant: "amber",
      },
    ],
  },
  {
    sectionKey: "INVENTORY",
    title: "สินค้า & คลังสต็อก // 03",
    items: [
      {
        label: "จัดการสินค้า (SKU)",
        href: "/admin/products",
        icon: Package,
      },
      {
        label: "จัดการหมวดหมู่เกม",
        href: "/admin/categories",
        icon: Layers,
      },
      {
        label: "แบนเนอร์ & ประกาศหน้าร้าน",
        href: "/admin/banners",
        icon: ImageIcon,
      },
      {
        label: "คลังสต็อกรหัสเกม (Vault)",
        href: "/admin/stocks",
        icon: Boxes,
        badge: "4 ใกล้หมด",
        badgeVariant: "red",
      },
    ],
  },
  {
    sectionKey: "MEMBERSHIP",
    title: "ผู้ใช้งาน & สิทธิ์สมาชิก // 04",
    items: [
      {
        label: "จัดการสมาชิก",
        href: "/admin/users",
        icon: Users,
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-obsidian-950 border-r border-zinc-800 flex flex-col justify-between select-none">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-800">
          <img
            src={siteConfig.logo}
            alt="KaiZort Logo"
            className="w-9 h-9 rounded-md object-cover bg-zinc-950 border border-zinc-700 shrink-0"
          />
          <div className="min-w-0">
            <span className="text-sm font-bold text-white tracking-tight font-display block truncate">
              KaiZort // ADMIN
            </span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block truncate">
              OPERATIONS MATRIX
            </span>
          </div>
        </div>

        {/* Grouped Navigation Sections */}
        <nav className="p-3 space-y-4">
          {adminNavSections.map((section) => (
            <div key={section.sectionKey} className="space-y-1">
              {/* Category Header Label */}
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 block">
                  {section.title}
                </span>
              </div>

              {/* Items in Section */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors group",
                        isActive
                          ? "bg-white text-zinc-950 font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/80",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0 transition-colors",
                            isActive
                              ? "text-zinc-950"
                              : "text-zinc-500 group-hover:text-zinc-300",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {/* Optional Badge */}
                      {item.badge && (
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded-sm text-[10px] font-mono font-semibold shrink-0 border ml-1",
                            isActive
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : item.badgeVariant === "amber"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : item.badgeVariant === "red"
                                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                                  : "bg-zinc-900 text-zinc-400 border-zinc-800",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Admin Profile & Return to Storefront Footer */}
      <div className="border-t border-zinc-800 bg-obsidian-900/90 divide-y divide-zinc-800/80">
        {/* Admin Operator Info */}
        <div className="p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-zinc-950 border border-zinc-700 flex items-center justify-center font-mono font-bold text-white text-xs shrink-0">
            KZ
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">
                KaiZort Admin
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </div>
            <span className="text-[10px] font-mono text-zinc-500 block truncate">
              ROOT // OWNER
            </span>
          </div>
        </div>

        {/* Back to Storefront Link */}
        <div className="p-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับไปยังหน้าร้าน KaiZort</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
