import { Check, X } from "lucide-react";
import { formatBaht } from "@/lib/format";

const mockPendingSlips = [
  {
    id: "slip_551",
    user: "player_99",
    amount: 500,
    bank: "KBANK",
    time: "10 นาทีที่แล้ว",
    ref: "2026101700145291",
  },
  {
    id: "slip_552",
    user: "topup_king",
    amount: 1000,
    bank: "SCB",
    time: "25 นาทีที่แล้ว",
    ref: "2026101700148812",
  },
];

export default function AdminTopupsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/[0.08]">
        <h1 className="text-xl font-bold text-white tracking-tight">
          ตรวจสอบสลิปการเติมเงิน (Payment Verification)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          ระบบตรวจสอบสลิปธนาคาร ปรับเพิ่มเครดิต และจัดการข้อผิดพลาด
        </p>
      </div>

      <div className="luxury-card rounded-xl overflow-hidden border border-white/[0.08]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-obsidian-900 border-b border-white/[0.08] text-[11px] font-semibold uppercase text-slate-400">
            <tr>
              <th className="py-3 px-4">สมาชิก</th>
              <th className="py-3 px-4">ยอดเงิน</th>
              <th className="py-3 px-4">ธนาคาร</th>
              <th className="py-3 px-4">เลขอ้างอิงสลิป</th>
              <th className="py-3 px-4">เวลาส่ง</th>
              <th className="py-3 px-4 text-right">การอนุมัติ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {mockPendingSlips.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 font-medium text-white">{s.user}</td>
                <td className="py-3 px-4 font-bold text-emerald-400 num-tabular">
                  {formatBaht(s.amount)}
                </td>
                <td className="py-3 px-4 text-slate-400">{s.bank}</td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{s.ref}</td>
                <td className="py-3 px-4 text-slate-500">{s.time}</td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>อนุมัติยอด</span>
                  </button>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ปฏิเสธ</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
