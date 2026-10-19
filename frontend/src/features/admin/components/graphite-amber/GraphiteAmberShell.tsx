"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Database,
  Users,
} from "lucide-react";

interface GraphiteAmberShellProps {
  children: React.ReactNode;
}

export function GraphiteAmberShell({ children }: GraphiteAmberShellProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/admin/dashboard",
      label: "ภาพรวม",
      icon: LayoutDashboard,
      active: pathname === "/admin/dashboard",
    },
    {
      href: "/admin/products",
      label: "สินค้า",
      icon: Package,
      active: pathname.startsWith("/admin/products"),
    },
    {
      href: "/admin/orders",
      label: "คำสั่งซื้อ",
      icon: ShoppingCart,
      active: pathname === "/admin/orders",
    },
    {
      href: "/admin/stocks",
      label: "คลังรหัส",
      icon: Database,
      active: pathname === "/admin/stocks",
    },
    {
      href: "/admin/users",
      label: "สมาชิก",
      icon: Users,
      active: pathname === "/admin/users",
    },
  ];

  return (
    <div className="min-h-screen bg-[#141210] text-[#f5f2eb] font-sans flex flex-col md:flex-row antialiased selection:bg-[#f59e0b] selection:text-[#141210]">
      {/* Icon Rail Shell: 76px on desktop, top bar on mobile */}
      <aside
        className="w-full md:w-[76px] shrink-0 bg-[#191715] border-b md:border-b-0 md:border-r border-[#332e29] flex flex-row md:flex-col items-center justify-between md:justify-start py-3 md:py-6 px-4 md:px-0 gap-2 md:gap-5 z-30"
        aria-label="แถบเมนูนำทางหลัก"
      >
        {/* Brand Monogram: K on Amber Badge */}
        <Link
          href="/admin/products"
          aria-label="โลโก้ KaiZort หลังบ้าน"
          title="KaiZort Admin Portal"
          className="w-11 h-11 rounded-xl bg-[#f59e0b] text-[#141210] font-bold text-xl flex items-center justify-center shadow-lg shadow-[#f59e0b]/20 hover:scale-105 transition-transform"
        >
          K
        </Link>

        {/* 5 Primary Icon Navigation Links */}
        <nav
          className="flex flex-row md:flex-col items-center gap-1.5 md:gap-3"
          aria-label="เมนูหลักหลังบ้าน"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  item.active
                    ? "bg-[#2b2622] text-[#f59e0b] shadow-inner border border-[#f59e0b]/30"
                    : "text-[#b3aba0] hover:text-[#f5f2eb] hover:bg-[#23201d]"
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        {/* Status Indicator at bottom for desktop */}
        <div className="hidden md:flex mt-auto flex-col items-center gap-2 pb-2">
          <div
            className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse"
            title="ระบบเชื่อมต่อสมบูรณ์"
            aria-label="ระบบเชื่อมต่อสมบูรณ์"
          />
        </div>
      </aside>

      {/* Main View Area with 40px padding on desktop */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 md:px-[40px] py-6 md:py-8 max-w-[1600px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
