"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Search,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { formatBaht } from "@/lib/format";

interface StoreUser {
  id: string;
  username: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  tier: "Standard" | "VIP" | "Diamond";
  balance: number;
  status: "ACTIVE" | "BANNED";
  registeredAt: string;
  totalOrders: number;
}

const initialUsers: StoreUser[] = [
  {
    id: "usr_001",
    username: "Sal***",
    email: "sal***@kaitanstudio.com",
    role: "ADMIN",
    tier: "Diamond",
    balance: 2500,
    status: "ACTIVE",
    registeredAt: "2026-09-01",
    totalOrders: 48,
  },
  {
    id: "usr_002",
    username: "dark_knight99",
    email: "dark@gamer.com",
    role: "MEMBER",
    tier: "VIP",
    balance: 1420,
    status: "ACTIVE",
    registeredAt: "2026-09-15",
    totalOrders: 19,
  },
  {
    id: "usr_003",
    username: "shadow_player",
    email: "shadow@roblox.in.th",
    role: "MEMBER",
    tier: "Standard",
    balance: 95,
    status: "ACTIVE",
    registeredAt: "2026-10-02",
    totalOrders: 4,
  },
  {
    id: "usr_004",
    username: "bloxfruits_king",
    email: "king@fruitgame.com",
    role: "MEMBER",
    tier: "VIP",
    balance: 350,
    status: "ACTIVE",
    registeredAt: "2026-10-10",
    totalOrders: 11,
  },
  {
    id: "usr_005",
    username: "suspicious_bot",
    email: "bot@fake.net",
    role: "MEMBER",
    tier: "Standard",
    balance: 0,
    status: "BANNED",
    registeredAt: "2026-10-14",
    totalOrders: 0,
  },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StoreUser[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MEMBER" | "ADMIN">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "BANNED">("ALL");
  const [notification, setNotification] = useState<string | null>(null);

  // Balance adjustment modal state
  const [balanceModalUser, setBalanceModalUser] = useState<StoreUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("เติมเงินชดเชยจากแอดมิน");

  // Add user modal state
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newBalance, setNewBalance] = useState<string>("0");
  const [newRole, setNewRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [newTier, setNewTier] = useState<"Standard" | "VIP" | "Diamond">("Standard");

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle user ban status
  const handleToggleBan = (user: StoreUser) => {
    const nextStatus = user.status === "ACTIVE" ? "BANNED" : "ACTIVE";
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)),
    );
    showNotification(
      `อัปเดตสถานะ ${user.username}: ${nextStatus === "BANNED" ? "ระงับบัญชีแล้ว" : "ปลดการระงับแล้ว"}`,
    );
  };

  // Toggle user role between MEMBER and ADMIN
  const handleToggleRole = (user: StoreUser) => {
    const nextRole = user.role === "MEMBER" ? "ADMIN" : "MEMBER";
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)),
    );
    showNotification(`ปรับเปลี่ยนสิทธิ์ของ ${user.username} เป็น ${nextRole}`);
  };

  // Save balance adjustment
  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalUser) return;

    const delta = parseFloat(adjustAmount);
    if (isNaN(delta) || delta === 0) {
      showNotification("กรุณาระบุจำนวนเงินที่ต้องการปรับยอด");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === balanceModalUser.id) {
          const newBal = Math.max(0, u.balance + delta);
          return { ...u, balance: newBal };
        }
        return u;
      }),
    );

    showNotification(
      `ปรับยอดเงินของ ${balanceModalUser.username} ${delta > 0 ? `+${delta}` : delta} บาท สำเร็จ`,
    );
    setBalanceModalUser(null);
    setAdjustAmount("");
  };

  // Add new user
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) {
      showNotification("กรุณากรอกชื่อผู้ใช้และอีเมล");
      return;
    }

    const created: StoreUser = {
      id: `usr_${Date.now()}`,
      username: newUsername.trim(),
      email: newEmail.trim(),
      balance: parseFloat(newBalance) || 0,
      role: newRole,
      tier: newTier,
      status: "ACTIVE",
      registeredAt: new Date().toISOString().slice(0, 10),
      totalOrders: 0,
    };

    setUsers((prev) => [created, ...prev]);
    setShowAddUserModal(false);
    setNewUsername("");
    setNewEmail("");
    setNewBalance("0");
    showNotification(`สร้างบัญชีผู้ใช้ ${created.username} เรียบร้อยแล้ว`);
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const totalMembers = users.length;
  const activeMembers = users.filter((u) => u.status === "ACTIVE").length;
  const bannedMembers = users.filter((u) => u.status === "BANNED").length;
  const totalBalance = users.reduce((acc, u) => acc + u.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            จัดการผู้ใช้งานร้านค้า (User Management)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ควบคุมสิทธิ์สมาชิก ปรับยอดเครดิตในกระเป๋า และจัดการระงับ/ปลดระงับบัญชี
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 self-start cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มสมาชิกใหม่</span>
        </button>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            สมาชิกทั้งหมด
          </span>
          <p className="text-2xl font-bold text-white num-tabular">
            {totalMembers} <span className="text-xs font-normal text-slate-400">คน</span>
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            สถานะปกติ (Active)
          </span>
          <p className="text-2xl font-bold text-emerald-400 num-tabular">
            {activeMembers} <span className="text-xs font-normal text-slate-400">คน</span>
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ถูกระงับบัญชี (Banned)
          </span>
          <p className="text-2xl font-bold text-red-400 num-tabular">
            {bannedMembers} <span className="text-xs font-normal text-slate-400">คน</span>
          </p>
        </div>

        <div className="luxury-card rounded-xl p-4 border border-white/[0.08] space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ยอดเครดิตหมุนเวียนรวม
          </span>
          <p className="text-2xl font-bold text-blue-400 num-tabular">
            {formatBaht(totalBalance)}
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="luxury-card rounded-2xl p-4 border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อผู้ใช้, อีเมล หรือรหัสสมาชิก..."
            className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
          {/* Role Filter */}
          <div className="flex p-0.5 rounded-lg bg-obsidian-900 border border-white/[0.06] text-[11px]">
            <button
              type="button"
              onClick={() => setRoleFilter("ALL")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                roleFilter === "ALL" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              ทุกสิทธิ์
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("MEMBER")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                roleFilter === "MEMBER" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Member
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("ADMIN")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                roleFilter === "ADMIN" ? "bg-white/[0.1] text-red-400 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex p-0.5 rounded-lg bg-obsidian-900 border border-white/[0.06] text-[11px]">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                statusFilter === "ALL" ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              ทุกสถานะ
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                statusFilter === "ACTIVE" ? "bg-white/[0.1] text-emerald-400" : "text-slate-400 hover:text-white"
              }`}
            >
              ปกติ
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("BANNED")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                statusFilter === "BANNED" ? "bg-white/[0.1] text-red-400" : "text-slate-400 hover:text-white"
              }`}
            >
              ระงับ
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="luxury-card rounded-xl overflow-hidden border border-white/[0.08]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-obsidian-900 border-b border-white/[0.08] text-[11px] font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">ผู้ใช้งาน / อีเมล</th>
                <th className="py-3 px-4">สิทธิ์ (Role)</th>
                <th className="py-3 px-4">ระดับสมาชิก (Tier)</th>
                <th className="py-3 px-4">ยอดเงินในกระเป๋า</th>
                <th className="py-3 px-4">ออเดอร์สะสม</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.status === "ACTIVE";
                  const isAdmin = u.role === "ADMIN";

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">
                              {u.username}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u)}
                          title="คลิกเพื่อสลับสิทธิ์ Admin / Member"
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                            isAdmin
                              ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                              : "bg-white/[0.06] text-slate-300 border-white/10 hover:bg-white/[0.1]"
                          }`}
                        >
                          {u.role}
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-300">{u.tier}</span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-white num-tabular">
                        {formatBaht(u.balance)}
                      </td>

                      <td className="py-3 px-4 text-slate-400 num-tabular">
                        {u.totalOrders} รายการ
                      </td>

                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ปกติ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            ถูกระงับ
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setBalanceModalUser(u);
                            setAdjustAmount("");
                          }}
                          className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          ปรับยอดเงิน
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBan(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            isActive
                              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {isActive ? "ระงับบัญชี" : "ปลดระงับ"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Balance Adjustment Modal */}
      {balanceModalUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setBalanceModalUser(null)}
        >
          <div
            className="w-full max-w-sm bg-obsidian-950 border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  ปรับยอดเงินกระเป๋า ({balanceModalUser.username})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBalanceModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBalance} className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block mb-1">
                  ยอดคงเหลือปัจจุบัน
                </span>
                <p className="text-base font-bold text-white num-tabular">
                  {formatBaht(balanceModalUser.balance)}
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  จำนวนเงินที่ต้องการปรับ (บาท)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="เช่น +100 หรือ -50"
                  className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white num-tabular focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  พิมพ์ตัวเลขบวกเพื่อเพิ่ม หรือติดลบเพื่อหักเงิน
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  เหตุผล / บันทึกช่วยจำ
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="ระบุเหตุผลในการปรับยอดเงิน..."
                  className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceModalUser(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  บันทึกยอดเงิน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add User Modal */}
      {showAddUserModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setShowAddUserModal(false)}
        >
          <div
            className="w-full max-w-md bg-obsidian-950 border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  เพิ่มสมาชิกใหม่เข้าสู่ระบบ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="เช่น player_zero"
                  className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  อีเมล (Email)
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="zero@kaitan.store"
                  className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    สิทธิ์เริ่มต้น
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "MEMBER" | "ADMIN")}
                    className="w-full bg-obsidian-900 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="MEMBER">MEMBER (ลูกค้าทั่วไป)</option>
                    <option value="ADMIN">ADMIN (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    ระดับสมาชิก
                  </label>
                  <select
                    value={newTier}
                    onChange={(e) =>
                      setNewTier(e.target.value as "Standard" | "VIP" | "Diamond")
                    }
                    className="w-full bg-obsidian-900 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="Standard">Standard</option>
                    <option value="VIP">VIP</option>
                    <option value="Diamond">Diamond</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  ยอดเงินเริ่มต้น (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-white num-tabular focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  สร้างผู้ใช้ใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
