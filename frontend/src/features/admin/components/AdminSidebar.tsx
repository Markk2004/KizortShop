"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Clock,
  CreditCard,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
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
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const isExpanded = isPinned || isHovered;

  return (
    <>
      {/* Invisible spacer to hold layout when sidebar is in slim/fixed mode */}
      <div
        className={cn(
          "shrink-0 transition-all duration-300 ease-in-out hidden md:block",
          isPinned ? "w-64" : "w-[68px]",
        )}
      />

      {/* Floating / Sliding Collapsible Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed top-0 left-0 h-screen z-40 bg-obsidian-950 border-r border-zinc-800 flex flex-col justify-between select-none transition-all duration-300 ease-in-out",
          isExpanded
            ? "w-64 shadow-2xl shadow-black/90"
            : "w-[68px] shadow-md",
        )}
      >
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
          {/* Brand Header */}
          <div
            className={cn(
              "h-16 flex items-center border-b border-zinc-800 transition-all duration-300 shrink-0",
              isExpanded ? "px-4 justify-between" : "px-0 justify-center",
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={siteConfig.logo}
                alt="KaiZort Logo"
                className="w-9 h-9 rounded-md object-cover bg-zinc-950 border border-zinc-700 shrink-0"
              />
              <div
                className={cn(
                  "min-w-0 transition-all duration-200 overflow-hidden",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 pointer-events-none",
                )}
              >
                <span className="text-sm font-bold text-white tracking-tight font-display block truncate whitespace-nowrap">
                  KaiZort // ADMIN
                </span>
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block truncate whitespace-nowrap">
                  OPERATIONS MATRIX
                </span>
              </div>
            </div>

            {/* Pin / Auto-collapse toggle button */}
            {isExpanded && (
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? "ยกเลิกการล็อกแถบ (เปิดโหมดซ่อนอัตโนมัติ)" : "ล็อกแถบไว้ตลอดเวลา"}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                {isPinned ? (
                  <Pin className="w-3.5 h-3.5 text-amber-400 rotate-45" />
                ) : (
                  <PinOff className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                )}
              </button>
            )}
          </div>

          {/* Grouped Navigation Sections */}
          <nav className="p-2.5 space-y-3.5">
            {adminNavSections.map((section) => (
              <div key={section.sectionKey} className="space-y-1">
                {/* Category Header Label */}
                <div
                  className={cn(
                    "transition-all duration-200 overflow-hidden",
                    isExpanded
                      ? "px-2.5 pt-2 pb-0.5 opacity-100 max-h-8"
                      : "opacity-0 max-h-0 pointer-events-none py-0",
                  )}
                >
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 block truncate whitespace-nowrap">
                    {section.title}
                  </span>
                </div>

                {!isExpanded && (
                  <div className="h-[1px] bg-zinc-800/60 my-1 mx-2" />
                )}

                {/* Items in Section */}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={!isExpanded ? item.label : undefined}
                        className={cn(
                          "flex items-center rounded-lg text-xs font-medium transition-all group relative",
                          isExpanded
                            ? "px-3 py-2 justify-between"
                            : "w-11 h-10 mx-auto justify-center",
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
                          <span
                            className={cn(
                              "truncate whitespace-nowrap transition-all duration-200",
                              isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                            )}
                          >
                            {item.label}
                          </span>
                        </div>

                        {/* Optional Badge */}
                        {item.badge && isExpanded && (
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

                        {/* Tooltip for collapsed state */}
                        {!isExpanded && (
                          <div className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                            {item.label}
                            {item.badge && (
                              <span className="ml-1.5 text-[10px] text-amber-400 font-mono">
                                ({item.badge})
                              </span>
                            )}
                          </div>
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
        <div className="border-t border-zinc-800 bg-obsidian-900/90 divide-y divide-zinc-800/80 shrink-0">
          {/* Admin Operator Info */}
          <div
            className={cn(
              "flex items-center transition-all duration-300",
              isExpanded ? "p-3.5 gap-3" : "p-3 justify-center",
            )}
          >
            <div className="w-8 h-8 rounded-md bg-zinc-950 border border-zinc-700 flex items-center justify-center font-mono font-bold text-white text-xs shrink-0">
              KZ
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 transition-all duration-200 overflow-hidden",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 pointer-events-none",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white truncate whitespace-nowrap">
                  KaiZort Admin
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 block truncate whitespace-nowrap">
                ROOT // OWNER
              </span>
            </div>
          </div>

          {/* Back to Storefront Link */}
          <div className="p-2.5">
            <Link
              href="/"
              title={!isExpanded ? "กลับไปยังหน้าร้าน KaiZort" : undefined}
              className={cn(
                "flex items-center rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 transition-colors group",
                isExpanded ? "justify-center gap-2 w-full py-2 px-3" : "w-11 h-9 mx-auto justify-center",
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
              <span
                className={cn(
                  "truncate whitespace-nowrap transition-all duration-200",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                )}
              >
                กลับไปยังหน้าร้าน
              </span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
