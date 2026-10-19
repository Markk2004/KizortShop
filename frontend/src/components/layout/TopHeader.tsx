"use client";

import Link from "next/link";
import { Bell, Search, ShieldAlert } from "lucide-react";
import { siteConfig } from "@/config/site";

export function TopHeader() {
  return (
    <header className="sticky top-0 h-16 shrink-0 bg-obsidian-950/90 backdrop-blur-md border-b border-zinc-800/80 px-6 flex items-center justify-between gap-6 z-30">
      {/* Brand Wordmark + Search Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <Link
          href="/"
          className="hidden md:flex items-center gap-2.5 pr-4 border-r border-zinc-800 shrink-0"
        >
          <img
            src={siteConfig.logo}
            alt="KZ Logo"
            className="w-7 h-7 rounded-sm object-cover border border-zinc-700"
          />
          <span className="text-sm font-bold tracking-tight text-white font-display">
            KaiZort
          </span>
        </Link>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหารหัสไก่ตัน, ผลตื่น, ดาบคู่... (Ctrl + K)"
            className="w-full bg-obsidian-900 border border-zinc-800 focus:border-zinc-500 rounded-md pl-10 pr-20 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded-sm text-[10px] text-zinc-400 font-mono">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/admin/dashboard"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-200 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
          title="เข้าสู่ระบบจัดการหลังบ้าน KaiZort"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
          <span>ระบบจัดการร้านค้า</span>
        </Link>

        <button
          type="button"
          aria-label="การแจ้งเตือน"
          className="relative p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-white" />
        </button>
      </div>
    </header>
  );
}
