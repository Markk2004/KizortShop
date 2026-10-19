"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";

export interface AdminPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function AdminPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  itemLabel = "รายการ",
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const padNum = (n: number) => String(n).padStart(2, "0");

  // Compute visible page numbers (up to 5 buttons with ellipsis if needed)
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis", totalPages];
    }
    if (safePage >= totalPages - 3) {
      return [
        1,
        "ellipsis",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      "ellipsis",
      safePage - 1,
      safePage,
      safePage + 1,
      "ellipsis",
      totalPages,
    ];
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="px-5 py-3.5 bg-zinc-950/90 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Left: Range Telemetry & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2.5 font-mono text-xs text-zinc-400 num-tabular">
          <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-200 font-semibold">
            หน้า {padNum(safePage)}/{padNum(totalPages)}
          </span>
          <span>
            แสดง{" "}
            <strong className="text-white font-semibold">
              {padNum(startItem)}–{padNum(endItem)}
            </strong>{" "}
            จากทั้งหมด <strong className="text-white font-semibold">{padNum(totalItems)}</strong>{" "}
            {itemLabel}
          </span>
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-2 pl-3 border-l border-zinc-800">
            <span className="text-xs font-mono text-zinc-400">แสดงต่อหน้า:</span>
            <div className="flex items-center bg-obsidian-900 border border-zinc-800 rounded-md p-0.5">
              {pageSizeOptions.map((size) => {
                const active = size === pageSize;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onPageSizeChange(size)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer num-tabular",
                      active
                        ? "bg-white text-zinc-950 font-bold"
                        : "text-zinc-400 hover:text-white",
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right: First / Prev / Page Numbers / Next / Last Controls */}
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          title="หน้าแรก (First Page)"
          aria-label="หน้าแรก"
          className="h-8 w-8 rounded-md bg-obsidian-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          title="หน้าก่อนหน้า (Previous Page)"
          className="h-8 px-3 rounded-md bg-obsidian-900 hover:bg-zinc-800 border border-zinc-800 flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline">ก่อนหน้า</span>
        </button>

        {/* Page Number Matrix */}
        <div className="flex items-center gap-1 px-0.5">
          {pageNumbers.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis_${idx}`}
                className="px-1.5 text-xs font-mono text-zinc-600 select-none"
              >
                ..
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={cn(
                  "h-8 min-w-[32px] px-2 rounded-md text-xs font-mono transition-colors cursor-pointer num-tabular",
                  item === safePage
                    ? "bg-white text-zinc-950 font-bold border border-white"
                    : "bg-obsidian-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800",
                )}
              >
                {padNum(item)}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          title="หน้าถัดไป (Next Page)"
          className="h-8 px-3 rounded-md bg-obsidian-900 hover:bg-zinc-800 border border-zinc-800 flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <span className="hidden md:inline">ถัดไป</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          title="หน้าสุดท้าย (Last Page)"
          aria-label="หน้าสุดท้าย"
          className="h-8 w-8 rounded-md bg-obsidian-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
