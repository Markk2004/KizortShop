"use client";

import { CheckCircle2 } from "lucide-react";
import { formatBaht } from "@/lib/format";
import type { RecentOrder } from "@/types";

export function OrderTicker({ orders }: { orders: RecentOrder[] }) {
  const seamlessOrders = [...orders, ...orders];

  return (
    <div className="rounded-lg border border-zinc-800 bg-obsidian-950 flex items-center overflow-hidden">
      {/* Scrolling Track */}
      <div className="relative w-full overflow-hidden py-1.5 px-2 [mask-image:linear-gradient(to_right,transparent,black_2%,black_98%,transparent)]">
        <div className="flex gap-2 w-max animate-marquee hover:[animation-play-state:paused]">
          {seamlessOrders.map((order, idx) => (
            <div
              key={`${order.id}-${idx}`}
              className="flex items-center gap-2 px-3 py-1 rounded-sm bg-obsidian-900 border border-zinc-800/80 hover:border-zinc-600 transition-colors shrink-0 cursor-default"
            >
              <span className="text-[10px] font-mono font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>SOLD</span>
              </span>

              <span className="text-xs font-mono text-zinc-400 shrink-0">
                {order.username}
              </span>

              <span className="text-zinc-700 text-[10px] select-none">/</span>

              <span className="text-xs text-zinc-200 font-medium max-w-[200px] truncate shrink-0">
                {order.productName}
              </span>

              <span className="text-zinc-700 text-[10px] select-none">/</span>

              <span className="text-xs font-mono font-bold text-white num-tabular shrink-0">
                {formatBaht(order.amount)}
              </span>

              <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                ({order.minutesAgo}m)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
