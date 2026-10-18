import Link from "next/link";
import { Gift, Headphones, QrCode, Star, type LucideIcon } from "lucide-react";

interface QuickActionItem {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
}

const actions: QuickActionItem[] = [
  { title: "กิจกรรมแจกไอดี", subtitle: "สุ่มแจกประจำสัปดาห์", href: "/support", icon: Gift },
  { title: "เติมเครดิตทันที", subtitle: "สแกน PromptPay 5 วินาที", href: "/topup", icon: QrCode },
  { title: "ติดต่อเจ้าหน้าที่", subtitle: "พร้อมดูแลตลอด 24 ชม.", href: "/support", icon: Headphones },
  { title: "รีวิวการซื้อ", subtitle: "คะแนนเฉลี่ย 5.0 ดาว", href: "#section-reviews", icon: Star },
];

export function QuickActions() {
  return (
    <section id="section-quick" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.title}
            href={item.href}
            className="luxury-card rounded-xl p-4 flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-white">{item.title}</h3>
              <p className="text-[11px] text-slate-500">{item.subtitle}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
