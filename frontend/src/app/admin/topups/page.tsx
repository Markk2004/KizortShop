"use client";

import { useState } from "react";
import { Check, CheckCircle2, X } from "lucide-react";
import { AdminPagination } from "@/features/admin/components/AdminPagination";
import {
  AdminSmartFilterBar,
  verifySearchInput,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";
import { formatBaht } from "@/lib/format";

interface TopupRow {
  id: string;
  user: string;
  amount: number;
  bank: string;
  time: string;
  ref: string;
  status: "PENDING_VERIFY" | "SUCCESS" | "REJECTED";
}

const initialSlips: TopupRow[] = [
  {
    id: "slip_551",
    user: "player_99",
    amount: 500,
    bank: "KBANK // PROMPTPAY",
    time: "10 นาทีที่แล้ว",
    ref: "2026101800145291",
    status: "PENDING_VERIFY",
  },
  {
    id: "slip_552",
    user: "topup_king",
    amount: 1000,
    bank: "SCB // PROMPTPAY",
    time: "25 นาทีที่แล้ว",
    ref: "2026101800148812",
    status: "PENDING_VERIFY",
  },
  {
    id: "slip_553",
    user: "newbie_01",
    amount: 150,
    bank: "TRUEMONEY ANGPAO",
    time: "38 นาทีที่แล้ว",
    ref: "TMN-8841920194",
    status: "PENDING_VERIFY",
  },
  {
    id: "slip_554",
    user: "zoro_fan",
    amount: 490,
    bank: "KBANK // PROMPTPAY",
    time: "1 ชม. ที่แล้ว",
    ref: "2026101800129940",
    status: "SUCCESS",
  },
  {
    id: "slip_555",
    user: "shadow_gamer",
    amount: 200,
    bank: "BBL // PROMPTPAY",
    time: "1 ชม. ที่แล้ว",
    ref: "2026101800118832",
    status: "SUCCESS",
  },
  {
    id: "slip_556",
    user: "kaizort_vip",
    amount: 300,
    bank: "KTB // PROMPTPAY",
    time: "2 ชม. ที่แล้ว",
    ref: "2026101800107721",
    status: "SUCCESS",
  },
  {
    id: "slip_557",
    user: "dark_knight99",
    amount: 1500,
    bank: "SCB // PROMPTPAY",
    time: "3 ชม. ที่แล้ว",
    ref: "2026101800095510",
    status: "SUCCESS",
  },
  {
    id: "slip_558",
    user: "suspicious_bot",
    amount: 2000,
    bank: "KBANK // MANUAL",
    time: "4 ชม. ที่แล้ว",
    ref: "DUP-202610180001",
    status: "REJECTED",
  },
  {
    id: "slip_559",
    user: "luna_gaming",
    amount: 250,
    bank: "TRUEMONEY ANGPAO",
    time: "5 ชม. ที่แล้ว",
    ref: "TMN-7731900412",
    status: "SUCCESS",
  },
  {
    id: "slip_560",
    user: "frost_wolf",
    amount: 350,
    bank: "KBANK // PROMPTPAY",
    time: "6 ชม. ที่แล้ว",
    ref: "2026101800064419",
    status: "SUCCESS",
  },
  {
    id: "slip_561",
    user: "sniper_x",
    amount: 700,
    bank: "SCB // PROMPTPAY",
    time: "7 ชม. ที่แล้ว",
    ref: "2026101800051108",
    status: "SUCCESS",
  },
  {
    id: "slip_562",
    user: "momo_chan",
    amount: 500,
    bank: "KBANK // PROMPTPAY",
    time: "8 ชม. ที่แล้ว",
    ref: "2026101800039981",
    status: "SUCCESS",
  },
];

export default function AdminTopupsPage() {
  const [slips, setSlips] = useState<TopupRow[]>(initialSlips);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING_VERIFY" | "SUCCESS" | "REJECTED"
  >("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateSlipStatus = (
    slip: TopupRow,
    newStatus: "SUCCESS" | "REJECTED",
  ) => {
    setSlips((prev) =>
      prev.map((s) => (s.id === slip.id ? { ...s, status: newStatus } : s)),
    );
    showNotification(
      newStatus === "SUCCESS"
        ? `อนุมัติสลิป ${slip.ref} (+${formatBaht(slip.amount)} ให้ @${slip.user})`
        : `ปฏิเสธสลิป ${slip.ref} ของ @${slip.user}`,
    );
  };

  const verification = verifySearchInput(searchQuery, searchMode);

  const filteredSlips = slips.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (!verification.isValid) return false;

    if (searchMode === "ORDER_ID" || searchMode === "SKU_CODE") {
      return s.ref.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    }
    if (searchMode === "USERNAME") {
      return s.user.toLowerCase().includes(q);
    }
    if (searchMode === "NUMBER_PRICE") {
      return String(s.amount).includes(q) || s.ref.includes(q);
    }

    return (
      s.user.toLowerCase().includes(q) ||
      s.ref.toLowerCase().includes(q) ||
      s.bank.toLowerCase().includes(q) ||
      String(s.amount).includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredSlips.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSlips = filteredSlips.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const pendingCount = slips.filter((s) => s.status === "PENDING_VERIFY").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1">
            KZ // PAYMENT & SLIP VERIFICATION
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ตรวจสอบสลิปการเติมเงิน (Payment Verification)
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            ตรวจสอบสลิปโอนเงิน PromptPay, ซองของขวัญ TrueMoney และโหมดอนุมัติมือ (Manual Fallback)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">PENDING VERIFY:</span>
          <span className="px-3.5 py-1.5 rounded-md text-sm font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 num-tabular">
            0{pendingCount} SLIPS
          </span>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

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
        placeholder="ค้นหาชื่อผู้ใช้ (@player_99), เลขอ้างอิงสลิป 16 หลัก หรือยอดเงิน..."
        totalMatched={filteredSlips.length}
        totalAll={slips.length}
      >
        <div className="flex p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
          {(["ALL", "PENDING_VERIFY", "SUCCESS", "REJECTED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {st === "PENDING_VERIFY" ? `PENDING (${pendingCount})` : st}
            </button>
          ))}
        </div>
      </AdminSmartFilterBar>

      {/* Table + Pagination (Readable 14px Typography) */}
      <div className="rounded-xl overflow-hidden bg-obsidian-900 border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-200">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-xs font-mono uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="py-3.5 px-5">USER</th>
                <th className="py-3.5 px-5">AMOUNT</th>
                <th className="py-3.5 px-5">CHANNEL // BANK</th>
                <th className="py-3.5 px-5">SLIP REFERENCE (@UNIQUE)</th>
                <th className="py-3.5 px-5">STATUS</th>
                <th className="py-3.5 px-5">TIME</th>
                <th className="py-3.5 px-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {paginatedSlips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-400 text-sm">
                    ไม่พบรายการเติมเงินที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedSlips.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/25 transition-colors">
                    <td className="py-4 px-5 font-mono font-bold text-white text-sm">
                      @{s.user}
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-emerald-400 text-base num-tabular">
                      {formatBaht(s.amount)}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-zinc-200">
                      {s.bank}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-zinc-300">
                      {s.ref}
                    </td>
                    <td className="py-4 px-5">
                      {s.status === "PENDING_VERIFY" && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          PENDING
                        </span>
                      )}
                      {s.status === "SUCCESS" && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          VERIFIED
                        </span>
                      )}
                      {s.status === "REJECTED" && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          REJECTED
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-zinc-400">
                      {s.time}
                    </td>
                    <td className="py-4 px-5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleUpdateSlipStatus(s, "SUCCESS")}
                        disabled={s.status === "SUCCESS"}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:pointer-events-none text-zinc-950 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>อนุมัติ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSlipStatus(s, "REJECTED")}
                        disabled={s.status === "REJECTED"}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-30 disabled:pointer-events-none border border-red-500/20 text-red-400 text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>ปฏิเสธ</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          currentPage={safePage}
          totalItems={filteredSlips.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="รายการสลิป"
        />
      </div>
    </div>
  );
}
