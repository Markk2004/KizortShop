import { MemberProfileView } from "@/features/member/components/MemberProfileView";
import type { MemberProfile } from "@/features/member/types";

const mockMember: MemberProfile = {
  id: "usr_9918",
  username: "Sal***",
  email: "sal***@kaitanstudio.com",
  balance: 250,
  totalOrders: 14,
  totalSpent: 4890,
  memberTier: "VIP",
  joinedDate: "12 ก.ย. 2026",
};

export default function MemberProfilePage() {
  return (
    <div className="pt-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            บัญชีสมาชิก (Member Center)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ข้อมูลส่วนบุคคล ประวัติการสั่งซื้อ และระดับสิทธิประโยชน์
          </p>
        </div>
      </div>

      <MemberProfileView profile={mockMember} />
    </div>
  );
}
