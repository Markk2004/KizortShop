"use client";

import { Clock, CreditCard, Shield, Wallet } from "lucide-react";
import { formatBaht } from "@/lib/format";
import type { MemberProfile } from "../types";

export function MemberProfileView({ profile }: { profile: MemberProfile }) {
  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="luxury-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {profile.username}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold uppercase">
                  {profile.memberTier}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {profile.email}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>สมัครสมาชิกเมื่อ {profile.joinedDate}</span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-obsidian-900/90 border border-white/[0.08] min-w-[200px]">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-blue-400" />
              <span>ยอดเงินคงเหลือ</span>
            </span>
            <p className="text-2xl font-bold text-white mt-1 num-tabular">
              {formatBaht(profile.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Member Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="luxury-card rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>คำสั่งซื้อทั้งหมด</span>
          </span>
          <p className="text-xl font-bold text-white mt-2 num-tabular">
            {profile.totalOrders} รายการ
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <span>ยอดใช้จ่ายสะสม</span>
          </span>
          <p className="text-xl font-bold text-white mt-2 num-tabular">
            {formatBaht(profile.totalSpent)}
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>ระดับความปลอดภัย</span>
          </span>
          <p className="text-xl font-bold text-emerald-400 mt-2">
            2FA ปลอดภัย 100%
          </p>
        </div>
      </div>
    </div>
  );
}
