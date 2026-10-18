import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0 || product.status === "OUT_OF_STOCK";

  return (
    <div
      className={cn(
        "luxury-card rounded-xl overflow-hidden flex flex-col justify-between group",
        soldOut && "opacity-50",
      )}
    >
      <div className="relative aspect-video bg-obsidian-950 overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          className={cn(
            "w-full h-full object-cover",
            soldOut
              ? "grayscale"
              : "group-hover:scale-105 transition-transform duration-500",
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/80 via-transparent to-transparent" />

        {soldOut ? (
          <div className="absolute inset-0 bg-obsidian-950/70 flex items-center justify-center">
            <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-white/10 border border-white/20 text-slate-300">
              สินค้าหมดชั่วคราว
            </span>
          </div>
        ) : (
          <>
            {product.badge && (
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-obsidian-900/90 text-slate-200 border border-white/10">
                {product.badge}
              </span>
            )}
            {product.discountPercent && (
              <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300 border border-white/10">
                -{product.discountPercent}%
              </span>
            )}
          </>
        )}

        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-obsidian-950/80 text-[10px] text-slate-400 font-mono">
          {product.code}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3
            className={cn(
              "font-semibold text-xs line-clamp-2 leading-relaxed",
              soldOut ? "text-slate-400" : "text-white",
            )}
          >
            {product.title}
          </h3>
          <div className="flex flex-wrap gap-1 mt-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px]",
                  soldOut
                    ? "bg-white/[0.04] text-slate-500"
                    : "bg-white/[0.05] text-slate-400",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
          <div>
            {product.originalPrice && !soldOut && (
              <span className="text-[10px] text-slate-500 line-through num-tabular">
                {formatBaht(product.originalPrice)}
              </span>
            )}
            <p
              className={cn(
                "text-base font-bold num-tabular",
                soldOut ? "text-slate-500" : "text-white",
              )}
            >
              {formatBaht(product.price)}
            </p>
          </div>

          {soldOut ? (
            <span className="text-[11px] text-slate-500 num-tabular">
              หมด • กำลังเติมสต็อก
            </span>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 num-tabular">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>เหลือ {product.stock} ชิ้น</span>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={soldOut}
          className={cn(
            "w-full py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
            soldOut
              ? "text-slate-500 bg-white/[0.04] cursor-not-allowed font-medium"
              : "text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer",
          )}
        >
          {soldOut ? (
            <span>สินค้าหมดชั่วคราว</span>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>สั่งซื้อสินค้า</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
