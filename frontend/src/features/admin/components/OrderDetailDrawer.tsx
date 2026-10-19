"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  User,
  X,
  Clock,
  FileText,
  CreditCard,
} from "lucide-react";
import { formatBaht } from "@/lib/format";

export interface OrderDrawerData {
  id: string;
  orderNumber: string;
  buyer: string;
  buyerEmail?: string;
  productTitle: string;
  categoryCode: string;
  deliveredCode: string;
  decryptedCredential?: string;
  amount: number;
  status: "COMPLETED" | "PENDING" | "REFUNDED";
  sla?: string;
  timeAgo: string;
  createdAtFull?: string;
  warrantyExpiresIn?: string;
}

interface OrderDetailDrawerProps {
  order: OrderDrawerData | null;
  onClose: () => void;
  onResendDm?: (order: OrderDrawerData) => void;
  onToggleRefund?: (order: OrderDrawerData) => void;
  onReplaceStock?: (order: OrderDrawerData) => void;
}

export function OrderDetailDrawer({
  order,
  onClose,
  onResendDm,
  onToggleRefund,
  onReplaceStock,
}: OrderDetailDrawerProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  useEffect(() => {
    setIsRevealed(false);
    setCopiedLabel(null);
  }, [order?.id]);

  if (!order) return null;

  const mockCredential =
    order.decryptedCredential ||
    `kz_${order.buyer.toLowerCase()}_${order.orderNumber.slice(-3)}:Pass#2026!KZ`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`รายละเอียดคำสั่งซื้อ ${order.orderNumber}`}
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Slide-over Panel */}
      <div
        className="w-full max-w-xl bg-obsidian-950 border-l border-zinc-800 h-full flex flex-col justify-between overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="px-6 py-5 bg-obsidian-900 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-sm bg-white text-zinc-950 font-mono text-xs font-bold">
                ORDER INSPECTOR
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {order.timeAgo}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight font-mono flex items-center gap-2.5">
              <span>#{order.orderNumber}</span>
              {order.status === "COMPLETED" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  COMPLETED
                </span>
              )}
              {order.status === "PENDING" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  PENDING
                </span>
              )}
              {order.status === "REFUNDED" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                  REFUNDED
                </span>
              )}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างรายละเอียด"
            className="w-10 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY CONTENT (Comfortable 14px-16px Typography) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-zinc-200">
          {copiedLabel && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>คัดลอก {copiedLabel} เรียบร้อยแล้ว</span>
            </div>
          )}

          {/* SECTION 1: Summary & Buyer Info */}
          <div className="rounded-xl bg-obsidian-900 border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-base">
                <User className="w-4 h-4 text-zinc-400" />
                <span>ข้อมูลผู้ซื้อ & ยอดชำระ</span>
              </div>
              <span className="font-mono text-xs text-zinc-400">
                ID: {order.id}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 block">
                  บัญชีผู้ซื้อ (Username)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white font-mono">
                    @{order.buyer}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.buyer, "ชื่อผู้ซื้อ")}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                    title="คัดลอกชื่อผู้ซื้อ"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs font-mono text-zinc-400 block">
                  {order.buyerEmail || `${order.buyer}@kaizort.member`}
                </span>
              </div>

              <div className="space-y-1 sm:text-right">
                <span className="text-xs text-zinc-400 block">
                  ยอดชำระสุทธิ (Wallet Escrow)
                </span>
                <span className="text-2xl font-bold text-white font-mono num-tabular block">
                  {formatBaht(order.amount)}
                </span>
                <span className="text-xs text-emerald-400 font-mono block">
                  หักเครดิตกระเป๋าสำเร็จ 100%
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Product & AES-256 Vault Credential */}
          <div className="rounded-xl bg-obsidian-900 border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-base">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>สินค้าและรหัสที่จัดส่ง (AES-256 Vault)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-xs font-bold">
                {order.categoryCode}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-zinc-400 block">ชื่อรายการสินค้า</span>
              <p className="text-base font-semibold text-white leading-snug">
                {order.productTitle}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-xs text-zinc-400 block mb-0.5">
                  รหัสอ้างอิงสต็อก (Stock Serial)
                </span>
                <span className="text-sm font-mono font-bold text-white">
                  {order.deliveredCode}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-xs text-zinc-400 block mb-0.5">
                  ความเร็วจัดส่งอัตโนมัติ (SLA)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  {order.sla || "0.8 วินาที"} (FIFO Lock)
                </span>
              </div>
            </div>

            {/* Credential Reveal Box */}
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  DECRYPTED CREDENTIAL PAYLOAD (USER:PASS)
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  AES-256-GCM VERIFIED
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-obsidian-900 px-3.5 py-2.5 rounded-md border border-zinc-800">
                <span className="font-mono text-base font-semibold text-white break-all">
                  {isRevealed
                    ? mockCredential
                    : `${mockCredential.slice(0, 6)}••••••••••••••••`}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsRevealed((prev) => !prev)}
                    className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isRevealed ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        <span>ซ่อนรหัส</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>ดูรหัสจริง</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(mockCredential, "รหัสเกมของลูกค้า")}
                    className="px-2.5 py-1.5 rounded bg-white hover:bg-zinc-200 text-xs font-bold text-zinc-950 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>คัดลอก</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Delivery & 24-Hour Warranty Timeline */}
          <div className="rounded-xl bg-obsidian-900 border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-base">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>ไทม์ไลน์การจัดส่ง & การรับประกัน 24 ชม.</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                อยู่ในประกัน ({order.warrantyExpiresIn || "เหลือ 21 ชม."})
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      1. ตัดเครดิตกระเป๋า & ล็อกสต็อกแบบ Atomic FIFO
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      สำเร็จทันที
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    ป้องกันการซื้อชนกันด้วยคำสั่ง FOR UPDATE SKIP LOCKED
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      2. ถอดรหัสและจัดส่งเข้ากล่องข้อความลูกค้า & Discord DM
                    </span>
                    <span className="font-mono text-xs text-emerald-400">
                      {order.sla || "0.8 วินาที"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    ลูกค้าเปิดดูรหัสได้จากหน้าประวัติการสั่งซื้อตลอด 24 ชม.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      3. ระยะเวลาคุ้มครองการเคลมไอดี (24-Hour SLA)
                    </span>
                    <span className="font-mono text-xs text-blue-400">
                      {order.warrantyExpiresIn || "เหลือ 21 ชม."}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    หากรหัสมีปัญหา แอดมินสามารถกดสลับไอดีใหม่หรือคืนเงินเข้ากระเป๋าได้ทันทีจากปุ่มด้านล่าง
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM QUICK ACTION BAR */}
        <div className="p-5 bg-obsidian-900 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {onResendDm && (
              <button
                type="button"
                onClick={() => onResendDm(order)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ส่งรหัสซ้ำเข้า DM</span>
              </button>
            )}

            {onReplaceStock && (
              <button
                type="button"
                onClick={() => onReplaceStock(order)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>เปลี่ยนไอดีเคลมใหม่</span>
              </button>
            )}
          </div>

          {onToggleRefund && (
            <button
              type="button"
              onClick={() => onToggleRefund(order)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                order.status === "REFUNDED"
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30"
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {order.status === "REFUNDED"
                  ? "ยกเลิกการคืนเงิน (กลับเป็นสำเร็จ)"
                  : "คืนเงินเคลม (Refund)"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
