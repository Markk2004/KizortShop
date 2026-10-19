"use client";

import { Bell } from "lucide-react";

export function AdminHeader() {
  return (
    <header className="h-16 shrink-0 bg-obsidian-950/90 backdrop-blur-md border-b border-zinc-800 px-6 flex items-center justify-between z-20">
      <div />

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="การแจ้งเตือนระบบ"
          className="relative p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-white" />
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-zinc-800">
          <img
            src="/assets/kaizort_logo_v4.jpeg"
            alt="KaiZort Admin Logo"
            className="w-7 h-7 rounded-sm object-cover border border-zinc-700"
          />
          <div className="text-left">
            <p className="text-xs font-semibold text-white leading-tight">
              KaiZort Admin
            </p>
            <p className="text-[10px] font-mono text-zinc-500 leading-tight">
              ROOT // SYS.01
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
