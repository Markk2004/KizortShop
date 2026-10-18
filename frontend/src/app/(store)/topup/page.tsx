import { QrCode, ShieldCheck, WalletCards } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function TopupPage() {
  return (
    <div className="pt-6 space-y-6 pb-8">
      <SectionHeader
        eyebrow="WALLET TOP-UP"
        title="เติมเครดิตเข้าระบบอัตโนมัติ"
        subtitle="รองรับสแกน QR PromptPay ทุกธนาคาร และซองของขวัญ TrueMoney ตลอด 24 ชั่วโมง"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="luxury-card rounded-xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">PromptPay QR อัตโนมัติ</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            สแกนจ่ายผ่านแอปธนาคารใดก็ได้ ยอดเงินปรับเข้ากระเป๋าทันทีภายใน 5 วินาที ไม่มีค่าธรรมเนียม
          </p>
          <span className="inline-block text-[11px] font-semibold text-emerald-400">
            พร้อมใช้งาน (เชื่อมต่อ Backend Phase 2)
          </span>
        </div>

        <div className="luxury-card rounded-xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <WalletCards className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">ซองของขวัญ TrueMoney</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            วางลิงก์ซองอั่งเปา TrueMoney Wallet ระบบตรวจสอบและเติมเครดิตให้อัตโนมัติทันที
          </p>
          <span className="inline-block text-[11px] font-semibold text-emerald-400">
            พร้อมใช้งาน (เชื่อมต่อ Backend Phase 2)
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-obsidian-900/60 p-4 flex items-center gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
        <span>ธุรกรรมทั้งหมดเข้ารหัสและตรวจสอบสลิปอัตโนมัติผ่าน Payment Gateway</span>
      </div>
    </div>
  );
}
