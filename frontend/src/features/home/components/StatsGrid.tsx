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
    <section
      id="section-stats"
      className="rounded-lg border border-zinc-800 bg-obsidian-900 overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-zinc-800"
    >
      {stats.map((stat, idx) => {
        const Icon = statIcons[stat.id] ?? ShieldCheck;
        return (
          <div key={stat.id} className="p-5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest">
                0{idx + 1} // {stat.label}
              </span>
              <Icon className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white font-mono num-tabular tracking-tight">
                {stat.value}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5 font-mono">
                {stat.noteTone === "positive" && (
                  <span className="w-1.5 h-1.5 bg-emerald-400" />
                )}
                <span className={stat.noteTone === "positive" ? "text-emerald-400" : undefined}>
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
