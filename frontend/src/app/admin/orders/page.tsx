import { formatBaht } from "@/lib/format";

const mockAllOrders = [
  {
    id: "ord_1001",
    buyer: "player_99",
    product: "ไก่ตัน Blox Fruits V4 หมัดก็อด",
    amount: 349,
    status: "COMPLETED",
    time: "3 นาทีที่แล้ว",
  },
  {
    id: "ord_1002",
    buyer: "zoro_fan",
    product: "Anime Defenders Unit Mythic",
    amount: 189,
    status: "COMPLETED",
    time: "15 นาทีที่แล้ว",
  },
  {
    id: "ord_1003",
    buyer: "newbie_01",
    product: "Robux Topup 1,000 R$",
    amount: 150,
    status: "PENDING",
    time: "24 นาทีที่แล้ว",
  },
];

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/[0.08]">
        <h1 className="text-xl font-bold text-white tracking-tight">
          คำสั่งซื้อทั้งหมดในระบบ (Orders Monitor)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          ตรวจสอบประวัติการซื้อของสมาชิก รหัสสินค้าที่จัดส่ง และจัดการการเคลม
        </p>
      </div>

      <div className="luxury-card rounded-xl overflow-hidden border border-white/[0.08]">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-obsidian-900 border-b border-white/[0.08] text-[11px] font-semibold uppercase text-slate-400">
            <tr>
              <th className="py-3 px-4">เลขออเดอร์</th>
              <th className="py-3 px-4">ผู้ซื้อ</th>
              <th className="py-3 px-4">สินค้า</th>
              <th className="py-3 px-4">ยอดเงิน</th>
              <th className="py-3 px-4">เวลา</th>
              <th className="py-3 px-4">สถานะ</th>
              <th className="py-3 px-4 text-right">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {mockAllOrders.map((o) => (
              <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400">{o.id}</td>
                <td className="py-3 px-4 font-medium text-white">{o.buyer}</td>
                <td className="py-3 px-4 text-slate-300">{o.product}</td>
                <td className="py-3 px-4 font-semibold text-white num-tabular">
                  {formatBaht(o.amount)}
                </td>
                <td className="py-3 px-4 text-slate-500">{o.time}</td>
                <td className="py-3 px-4">
                  {o.status === "COMPLETED" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      สำเร็จ
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      รอดำเนินการ
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-[11px] transition-colors"
                  >
                    ดูรายละเอียด
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
