import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";
import type { Category } from "@/types";

export function CategoryCard({ category }: { category: Category }) {
  const isOutOfStock =
    category.status === "OUT_OF_STOCK" ||
    Boolean(category.isOutOfStock) ||
    category.itemCount === 0;

  return (
    <Link
      href={`/products?category=${category.id}`}
      className={cn(
        "luxury-card rounded-lg overflow-hidden flex flex-col justify-between group",
        isOutOfStock && "opacity-75",
      )}
    >
      <div className="relative aspect-[16/9] w-full bg-obsidian-950 overflow-hidden border-b border-zinc-800/80">
        <img
          src={category.image}
          alt={category.name}
          className={cn(
            "w-full h-full object-cover transition-transform duration-500",
            isOutOfStock ? "grayscale-[50%]" : "group-hover:scale-105",
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/90 via-obsidian-950/30 to-transparent" />
        {isOutOfStock ? (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-red-500/20 text-red-400 border border-red-500/30">
            สินค้าหมดชั่วคราว
          </span>
        ) : category.hot ? (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-white text-zinc-950 uppercase tracking-wide">
            HOT // POPULAR
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded-sm bg-obsidian-950/90 text-zinc-300 border border-zinc-700 num-tabular">
            {category.itemCount} IDs
          </span>
        )}
      </div>

      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-white group-hover:text-zinc-200 transition-colors">
            {category.name}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
            {category.description}
          </p>
        </div>

        <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
          <span className="text-zinc-500 font-mono">
            {isOutOfStock ? "STATUS:" : "PRICE RANGE:"}
          </span>
          {isOutOfStock ? (
            <span className="text-red-400 font-medium">สินค้าหมดชั่วคราว</span>
          ) : (
            <span className="text-white font-mono font-bold num-tabular">
              {formatBaht(category.priceMin, false)} – {formatBaht(category.priceMax, false)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
