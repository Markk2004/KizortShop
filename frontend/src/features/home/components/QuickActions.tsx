import Link from "next/link";
import { ArrowUpRight, Gift, Headphones, QrCode, Star, type LucideIcon } from "lucide-react";

interface QuickActionItem {
  code: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
}

const actions: QuickActionItem[] = [
  { code: "ACT.01", title: "กิจกรรมแจกไอดี", subtitle: "สุ่มแจกประจำสัปดาห์", href: "/support", icon: Gift },
  { code: "ACT.02", title: "เติมเครดิตทันที", subtitle: "สแกน PromptPay 5 วินาที", href: "/topup", icon: QrCode },
  { code: "ACT.03", title: "ติดต่อเจ้าหน้าที่", subtitle: "พร้อมดูแลตลอด 24 ชม.", href: "/support", icon: Headphones },
  { code: "ACT.04", title: "รีวิวการซื้อจริง", subtitle: "คะแนนเฉลี่ย 5.0 ดาว", href: "#section-reviews", icon: Star },
];

export function QuickActions() {
  return (
    <section
      id="section-quick"
      className="rounded-lg border border-zinc-800 bg-obsidian-900 overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-zinc-800"
    >
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.title}
            href={item.href}
            className="p-4 flex items-center justify-between gap-3 hover:bg-zinc-800/35 transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-white group-hover:border-zinc-600 transition-colors shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-mono text-zinc-500 block">
                  {item.code}
                </span>
                <h3 className="font-semibold text-xs text-white truncate">
                  {item.title}
                </h3>
                <p className="text-[11px] text-zinc-500 truncate">{item.subtitle}</p>
              </div>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors shrink-0 hidden sm:block" />
          </Link>
        );
      })}
    </section>
  );
}
