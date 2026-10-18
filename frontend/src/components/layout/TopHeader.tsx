"use client";

import Link from "next/link";
import { Bell, Search, ShieldAlert } from "lucide-react";

export function TopHeader() {
  return (
    <header className="sticky top-0 h-16 shrink-0 bg-obsidian-950/80 backdrop-blur-xl border-b border-white/[0.07] px-6 flex items-center justify-between gap-6 z-30">
      {/* Search Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหารหัสไก่ตัน, ผลตื่น, ดาบคู่... (Ctrl + K)"
            className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-white/20 rounded-lg pl-10 pr-20 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-mono">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/dashboard"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors"
          title="เข้าสู่ระบบจัดการหลังบ้าน"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <span>ระบบจัดการร้านค้า</span>
        </Link>

        <button
          type="button"
          aria-label="การแจ้งเตือน"
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
        </button>
      </div>
    </header>
  );
}
