"use client";

import { Bell, ShieldCheck } from "lucide-react";

export function AdminHeader() {
  return (
    <header className="h-16 shrink-0 bg-obsidian-950/80 backdrop-blur-xl border-b border-white/[0.08] px-6 flex items-center justify-between z-20">
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold flex items-center gap-1.5 font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ADMIN ACCESS PRIVILEGE</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="การแจ้งเตือนระบบ"
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-white/[0.08]">
          <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400">
            A
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-white leading-tight">
              Administrator
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              Root Level
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
