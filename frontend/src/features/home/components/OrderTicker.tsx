"use client";

import { CheckCircle2 } from "lucide-react";
import { formatBaht } from "@/lib/format";
import type { RecentOrder } from "@/types";

export function OrderTicker({ orders }: { orders: RecentOrder[] }) {
  // Duplicate orders to create a continuous seamless loop
  const seamlessOrders = [...orders, ...orders];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-obsidian-950 p-1.5 sm:p-2 flex items-center overflow-hidden">
      {/* Full Width Scrolling Track with Soft Edge Fade */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_2%,black_98%,transparent)]">
        <div className="flex gap-2.5 w-max animate-marquee hover:[animation-play-state:paused] py-0.5">
          {seamlessOrders.map((order, idx) => (
            <div
              key={`${order.id}-${idx}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-obsidian-900 border border-white/[0.06] hover:border-white/15 transition-colors shrink-0 cursor-default"
            >
              {/* Delivery Status - Clean text, no box */}
              <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>จัดส่งออโต้</span>
              </span>

              {/* Username */}
              <span className="text-xs font-medium text-slate-400 font-mono shrink-0">
                {order.username}
              </span>

              <span className="text-slate-700 text-[10px] select-none">•</span>

              {/* Product Name */}
              <span className="text-xs text-slate-300 font-medium max-w-[200px] truncate shrink-0">
                {order.productName}
              </span>

              <span className="text-slate-700 text-[10px] select-none">•</span>

              {/* Price - Clean solid white, no neon box */}
              <span className="text-xs font-semibold text-white num-tabular shrink-0">
                {formatBaht(order.amount)}
              </span>

              {/* Time Ago */}
              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                ({order.minutesAgo} น.)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
