import { Headphones, ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function SupportPage() {
  return (
    <div className="pt-6 space-y-6 pb-8">
      <SectionHeader
        eyebrow="SUPPORT & WARRANTY"
        title="แจ้งปัญหาเคลมสินค้าและเงื่อนไขการรับประกัน"
        subtitle="ทีมงานพร้อมตรวจสอบและดูแลหลังการขายตลอด 24 ชั่วโมง"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="luxury-card rounded-xl p-6 space-y-2.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">เงื่อนไขการรับประกันสินค้า</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            กรุณาบันทึกวิดีโอหน้าจอตั้งแต่ขั้นตอนการกดสั่งซื้อจนถึงการเข้าสู่ระบบไอดีเกมครั้งแรกโดยไม่ตัดต่อ เพื่อใช้เป็นหลักฐานในการเคลมสินค้า 100%
          </p>
        </div>

        <div className="luxury-card rounded-xl p-6 space-y-2.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Headphones className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">เปิดตั๋วแจ้งปัญหา (Support Ticket)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            แจ้งรหัสคำสั่งซื้อพร้อมแนบลิงก์วิดีโอเพื่อให้แอดมินตรวจสอบและเปลี่ยนไอดีใหม่ให้ทันที
          </p>
        </div>
      </div>
    </div>
  );
}
