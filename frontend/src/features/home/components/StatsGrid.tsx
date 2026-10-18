import { Layers, PackageCheck, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { StoreStat } from "@/types";

const statIcons: Record<string, LucideIcon> = {
  users: Users,
  categories: Layers,
  stock: PackageCheck,
  orders: ShieldCheck,
};

export function StatsGrid({ stats }: { stats: StoreStat[] }) {
  return (
    <section id="section-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = statIcons[stat.id] ?? ShieldCheck;
        return (
          <div key={stat.id} className="luxury-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">
                {stat.label}
              </span>
              <Icon className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white num-tabular">{stat.value}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                {stat.noteTone === "positive" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
                <span className={stat.noteTone === "positive" ? "text-emerald-400/90" : undefined}>
                  {stat.note}
                </span>
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
