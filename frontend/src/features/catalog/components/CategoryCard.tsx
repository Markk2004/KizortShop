import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import type { Category } from "@/types";

const hoverColors: Record<Category["accent"], string> = {
  blue: "group-hover:text-blue-400",
  sky: "group-hover:text-sky-400",
  indigo: "group-hover:text-indigo-400",
  amber: "group-hover:text-amber-400",
};

export function CategoryCard({ category }: { category: Category }) {
  const isOutOfStock =
    category.status === "OUT_OF_STOCK" ||
    Boolean(category.isOutOfStock) ||
    category.itemCount === 0;

  return (
    <Link
      href={`/products?category=${category.id}`}
      className={cn(
        "luxury-card rounded-xl overflow-hidden flex flex-col justify-between group",
        isOutOfStock && "opacity-80",
      )}
    >
      <div className="relative aspect-[16/9] w-full bg-obsidian-950 overflow-hidden">
        <img
          src={category.image}
          alt={category.name}
          className={cn(
            "w-full h-full object-cover transition-transform duration-500",
            isOutOfStock ? "grayscale-[40%]" : "group-hover:scale-105",
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/90 via-obsidian-950/30 to-transparent" />
        {isOutOfStock ? (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
            สินค้าหมดชั่วคราว
          </span>
        ) : category.hot ? (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wide">
            HOT DEAL
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-medium px-2 py-0.5 rounded bg-obsidian-950/80 text-slate-300 border border-white/10 num-tabular">
            {category.itemCount} รายการ
          </span>
        )}
      </div>

      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
        <div>
          <h3
            className={cn(
              "text-xs font-bold text-white transition-colors",
              isOutOfStock ? "text-slate-300" : hoverColors[category.accent],
            )}
          >
            {category.name}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
            {category.description}
          </p>
        </div>

        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{isOutOfStock ? "สถานะการจำหน่าย:" : "ช่วงราคา:"}</span>
          {isOutOfStock ? (
            <span className="text-red-400 font-medium">สินค้าหมดชั่วคราว</span>
          ) : (
            <span className="text-white font-bold num-tabular">
              {formatBaht(category.priceMin, false)} – {formatBaht(category.priceMax, false)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
