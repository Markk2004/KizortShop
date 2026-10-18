import { Clock3 } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function OrdersPage() {
  return (
    <div className="pt-6 space-y-6 pb-8">
      <SectionHeader
        eyebrow="ORDER HISTORY"
        title="ประวัติการสั่งซื้อและรับรหัสสินค้า"
        subtitle="ตรวจสอบข้อมูลไอดีเกมและรหัสผ่านที่สั่งซื้อสำเร็จทั้งหมด"
      />

      <div className="luxury-card rounded-xl p-8 text-center space-y-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-400 mx-auto">
          <Clock3 className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-white">รายการคำสั่งซื้อของคุณ</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          ส่วนแสดงผลประวัติการสั่งซื้อและปุ่มคัดลอกข้อมูลไอดี (เชื่อมต่อกับโมดูล orders ใน Backend Phase 2)
        </p>
      </div>
    </div>
  );
}
