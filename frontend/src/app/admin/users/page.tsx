"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Search,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { formatBaht } from "@/lib/format";
import { AdminPagination } from "@/features/admin/components/AdminPagination";
import {
  AdminSmartFilterBar,
  verifySearchInput,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";
import {
  fetchAdminUsers,
  adjustUserBalance,
  updateUserRole,
  updateUserStatus,
  createAdminUser,
  type AdminUserApiResponse,
} from "@/features/admin/services/admin-api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MEMBER" | "ADMIN">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "BANNED">("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [notification, setNotification] = useState<string | null>(null);

  // Balance adjustment modal state
  const [balanceModalUser, setBalanceModalUser] = useState<AdminUserApiResponse | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("เติมเงินชดเชยจากแอดมิน");

  // Add user modal state
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newBalance, setNewBalance] = useState<string>("0");
  const [newRole, setNewRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [newTier, setNewTier] = useState<"Standard" | "VIP" | "Diamond">("Standard");

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminUsers();
      setUsers(res);
    } catch (err) {
      console.warn("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle user ban status
  const handleToggleBan = async (user: AdminUserApiResponse) => {
    const nextStatus = user.status === "ACTIVE" ? "BANNED" : "ACTIVE";
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)),
    );
    try {
      await updateUserStatus(user.id, nextStatus);
    } catch {}
    showNotification(
      `อัปเดตสถานะ ${user.username}: ${nextStatus === "BANNED" ? "ระงับบัญชีแล้ว" : "ปลดการระงับแล้ว"}`,
    );
  };

  // Toggle user role between MEMBER and ADMIN
  const handleToggleRole = async (user: AdminUserApiResponse) => {
    const nextRole = user.role === "MEMBER" ? "ADMIN" : "MEMBER";
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)),
    );
    try {
      await updateUserRole(user.id, nextRole);
    } catch {}
    showNotification(`ปรับเปลี่ยนสิทธิ์ของ ${user.username} เป็น ${nextRole}`);
  };

  // Save balance adjustment
  const handleSaveBalance = async (e: React.FormEvent) => {
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

    try {
      await adjustUserBalance(balanceModalUser.id, delta, adjustReason);
    } catch {}

    showNotification(
      `ปรับยอดเงินของ ${balanceModalUser.username} ${delta > 0 ? `+${delta}` : delta} บาท สำเร็จ`,
    );
    setBalanceModalUser(null);
    setAdjustAmount("");
  };

  // Add new user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) {
      showNotification("กรุณากรอกชื่อผู้ใช้และอีเมล");
      return;
    }

    try {
      const createdRes = await createAdminUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        balance: parseFloat(newBalance) || 0,
        role: newRole,
        tier: newTier,
      });

      if (createdRes?.data) {
        setUsers((prev) => [createdRes.data, ...prev]);
      } else {
        await loadUsers();
      }
      setShowAddUserModal(false);
      setNewUsername("");
      setNewEmail("");
      setNewBalance("0");
      showNotification(`สร้างบัญชีผู้ใช้ ${newUsername} เรียบร้อยแล้ว`);
    } catch (err: any) {
      showNotification("สร้างผู้ใช้ไม่สำเร็จ: " + (err?.message || ""));
    }
  };

  const verification = verifySearchInput(searchQuery, searchMode);

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (!verification.isValid) return false;

    if (searchMode === "ORDER_ID" || searchMode === "SKU_CODE") {
      return u.id.toLowerCase().includes(q) || u.tier.toLowerCase().includes(q);
    }
    if (searchMode === "USERNAME") {
      return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    if (searchMode === "NUMBER_PRICE") {
      return String(u.balance).includes(q) || String(u.totalOrders).includes(q);
    }

    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.tier.toLowerCase().includes(q) ||
      String(u.balance).includes(q)
    );
  });

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const totalMembers = users.length;
  const activeMembers = users.filter((u) => u.status === "ACTIVE").length;
  const bannedMembers = users.filter((u) => u.status === "BANNED").length;
  const totalBalance = users.reduce((acc, u) => acc + u.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1">
            KZ // MEMBER DIRECTORY & WALLET ACCESS
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            จัดการผู้ใช้งานร้านค้า (User Management)
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            ควบคุมสิทธิ์สมาชิก ปรับยอดเครดิตในกระเป๋า และจัดการระงับ/ปลดระงับบัญชี
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2 self-start cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มสมาชิกใหม่</span>
        </button>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl p-5 bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
            01 // สมาชิกทั้งหมด
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            {totalMembers} <span className="text-xs font-normal text-zinc-400">คน</span>
          </p>
        </div>

        <div className="rounded-xl p-5 bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
            02 // สถานะปกติ (Active)
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-400 num-tabular">
            {activeMembers} <span className="text-xs font-normal text-zinc-400">คน</span>
          </p>
        </div>

        <div className="rounded-xl p-5 bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
            03 // ถูกระงับบัญชี (Banned)
          </span>
          <p className="text-2xl font-bold font-mono text-red-400 num-tabular">
            {bannedMembers} <span className="text-xs font-normal text-zinc-400">คน</span>
          </p>
        </div>

        <div className="rounded-xl p-5 bg-obsidian-900 border border-zinc-800 space-y-1">
          <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
            04 // ยอดเครดิตหมุนเวียนรวม
          </span>
          <p className="text-2xl font-bold font-mono text-white num-tabular">
            {formatBaht(totalBalance)}
          </p>
        </div>
      </div>

      {/* Smart Filter & Search Verification Bar */}
      <AdminSmartFilterBar
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchMode={searchMode}
        onSearchModeChange={(m) => {
          setSearchMode(m);
          setCurrentPage(1);
        }}
        placeholder="ค้นหาชื่อผู้ใช้ (dark_knight99), อีเมล, รหัสสมาชิก (usr_002) หรือยอดเงิน..."
        totalMatched={filteredUsers.length}
        totalAll={users.length}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <div className="flex p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setRoleFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                roleFilter === "ALL"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ทุกสิทธิ์
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter("MEMBER");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                roleFilter === "MEMBER"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              MEMBER
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleFilter("ADMIN");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                roleFilter === "ADMIN"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ADMIN
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ทุกสถานะ
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ACTIVE");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ปกติ
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("BANNED");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === "BANNED"
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ระงับ
            </button>
          </div>
        </div>
      </AdminSmartFilterBar>

      {/* Users Table (Readable 14px Typography) */}
      <div className="rounded-xl overflow-hidden bg-obsidian-900 border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-200">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-xs font-mono uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="py-3.5 px-5">ผู้ใช้งาน / อีเมล</th>
                <th className="py-3.5 px-5">สิทธิ์ (Role)</th>
                <th className="py-3.5 px-5">ระดับสมาชิก (Tier)</th>
                <th className="py-3.5 px-5">ยอดเงินในกระเป๋า</th>
                <th className="py-3.5 px-5">ออเดอร์สะสม</th>
                <th className="py-3.5 px-5">สถานะ</th>
                <th className="py-3.5 px-5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-400 text-sm">
                    ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isActive = u.status === "ACTIVE";
                  const isAdmin = u.role === "ADMIN";

                  return (
                    <tr key={u.id} className="hover:bg-zinc-800/25 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-700 flex items-center justify-center text-sm font-mono font-bold text-white shrink-0">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white text-sm block">
                              {u.username}
                            </span>
                            <span className="text-xs text-zinc-400 font-mono block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u)}
                          title="คลิกเพื่อสลับสิทธิ์ Admin / Member"
                          className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                            isAdmin
                              ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
                              : "bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800"
                          }`}
                        >
                          {u.role}
                        </button>
                      </td>

                      <td className="py-4 px-5">
                        <span className="font-medium text-zinc-200 text-sm">{u.tier}</span>
                      </td>

                      <td className="py-4 px-5 font-mono font-bold text-white text-base num-tabular">
                        {formatBaht(u.balance)}
                      </td>

                      <td className="py-4 px-5 font-mono text-zinc-300 text-sm num-tabular">
                        {u.totalOrders} รายการ
                      </td>

                      <td className="py-4 px-5">
                        {isActive ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ปกติ
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            ถูกระงับ
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setBalanceModalUser(u);
                            setAdjustAmount("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                        >
                          ปรับยอดเงิน
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBan(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isActive
                              ? "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30"
                              : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
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
        <AdminPagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="สมาชิก"
        />
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
