import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { AdminMetric } from "../types";

export function MetricCard({ metric }: { metric: AdminMetric }) {
  return (
    <div className="luxury-card rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">
          {metric.title}
        </span>
        <div className="flex items-center gap-1 text-[11px] font-semibold">
          {metric.trend === "up" && (
            <span className="text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {metric.change}
            </span>
          )}
          {metric.trend === "down" && (
            <span className="text-red-400 flex items-center">
              <ArrowDownRight className="w-3.5 h-3.5" />
              {metric.change}
            </span>
          )}
          {metric.trend === "neutral" && (
            <span className="text-slate-400 flex items-center">
              <Minus className="w-3.5 h-3.5" />
              {metric.change}
            </span>
          )}
        </div>
      </div>

      <p className="text-2xl font-bold text-white tracking-tight num-tabular">
        {metric.value}
      </p>

      <p className="text-[11px] text-slate-500">
        {metric.description}
      </p>
    </div>
  );
}
