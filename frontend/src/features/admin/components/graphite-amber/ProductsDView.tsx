"use client";

import React, { useState } from "react";
import { Plus, Check, AlertCircle } from "lucide-react";
import { formatBaht } from "@/lib/format";
import {
  AdminSmartFilterBar,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";

export interface GraphiteProduct {
  id: string;
  code: string;
  title: string;
  category: string;
  price: number;
  stock: number;
  status: "AVAILABLE" | "OUT_OF_STOCK";
  sold?: number;
}

interface ProductsDViewProps {
  products: GraphiteProduct[];
  onToggleStatus: (product: GraphiteProduct) => void;
  onOpenAddModal: () => void;
  onEditProduct: (product: GraphiteProduct) => void;
}

export function ProductsDView({
  products,
  onToggleStatus,
  onOpenAddModal,
  onEditProduct,
}: ProductsDViewProps) {
  const [filterMode, setFilterMode] = useState<"ALL" | "AVAILABLE" | "OUT_OF_STOCK">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");

  const totalAll = products.length;
  const totalAvailable = products.filter((p) => p.status === "AVAILABLE" && p.stock > 0).length;
  const totalOutOfStock = products.filter((p) => p.status === "OUT_OF_STOCK" || p.stock === 0).length;

  const filteredProducts = products.filter((p) => {
    const isAvail = p.status === "AVAILABLE" && p.stock > 0;
    if (filterMode === "AVAILABLE" && !isAvail) return false;
    if (filterMode === "OUT_OF_STOCK" && isAvail) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.code.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.price.toString().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4.1 Header Bar consistent with KaiZort Admin Portal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest block">
            KZ // CATALOG MANAGEMENT
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            จัดการสินค้าและคลังไอดีเกม
          </h1>
          <p className="text-sm text-zinc-400">
            ควบคุมรายการสินค้า ตั้งค่าราคา จำนวนสต็อก และสถานะการวางจำหน่ายบนหน้าร้าน
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="h-11 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ เพิ่มสินค้าใหม่</span>
        </button>
      </div>

      {/* Smart Filter & Realtime Verification Bar */}
      <AdminSmartFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        placeholder="ค้นหารหัส SKU (BF-V4), ชื่อสินค้า หรือราคา..."
        totalMatched={filteredProducts.length}
        totalAll={totalAll}
      >
        {/* Filter Pills with Live Counts */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800"
          role="group"
          aria-label="ตัวกรองสถานะสินค้า"
        >
          <button
            type="button"
            onClick={() => setFilterMode("ALL")}
            aria-pressed={filterMode === "ALL"}
            className={`h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
              filterMode === "ALL"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="opacity-70">·</span>
            <span>{totalAll}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode("AVAILABLE")}
            aria-pressed={filterMode === "AVAILABLE"}
            className={`h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
              filterMode === "AVAILABLE"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>มีสินค้า</span>
            <span className="opacity-70">·</span>
            <span>{totalAvailable}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode("OUT_OF_STOCK")}
            aria-pressed={filterMode === "OUT_OF_STOCK"}
            className={`h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
              filterMode === "OUT_OF_STOCK"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>หมดชั่วคราว</span>
            <span className="opacity-70">·</span>
            <span>{totalOutOfStock}</span>
          </button>
        </div>
      </AdminSmartFilterBar>

      {/* Product Cards Container (Card-per-row with Dark Carbon theme) */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40">
            <p className="text-sm text-zinc-400">
              ไม่มีสินค้าในสถานะนี้ หรือไม่พบข้อมูลตามคำค้นหา
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isAvailable = product.status === "AVAILABLE" && product.stock > 0;

            return (
              <div
                key={product.id}
                className="rounded-xl p-4 sm:p-5 bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group shadow-sm"
              >
                {/* Left: SKU Badge */}
                <div className="shrink-0">
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-zinc-950 text-amber-400 font-mono font-bold text-xs border border-amber-500/30">
                    {product.code}
                  </span>
                </div>

                {/* Middle: Title & Meta Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-base font-semibold text-white leading-snug line-clamp-1">
                    {product.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400 font-mono">
                    <span className="text-zinc-300 font-sans">{product.category}</span>
                    <span>·</span>
                    <span className="text-white font-bold text-sm">
                      {formatBaht(product.price)}
                    </span>
                    <span>·</span>
                    <span>
                      สต็อก{" "}
                      {product.stock === 0 ? (
                        <span className="text-red-400 font-bold">0 ไอดี</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">
                          {product.stock} ไอดี
                        </span>
                      )}
                    </span>
                    {typeof product.sold === "number" && (
                      <>
                        <span>·</span>
                        <span className="text-zinc-500">ขายแล้ว {product.sold}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Status Pill & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800/80">
                  {/* Status Capsule */}
                  {isAvailable ? (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>มีสินค้า</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>สินค้าหมดชั่วคราว</span>
                    </span>
                  )}

                  {/* Toggle Status Button (40px high) */}
                  {isAvailable ? (
                    <button
                      type="button"
                      onClick={() => onToggleStatus(product)}
                      className="h-10 px-3.5 rounded-lg border border-zinc-700 hover:border-red-500/60 bg-zinc-950 hover:bg-red-500/10 text-zinc-300 hover:text-red-400 text-xs font-medium transition-colors cursor-pointer"
                    >
                      ปรับเป็นสินค้าหมดชั่วคราว
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleStatus(product)}
                      className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      ปรับเป็นมีสินค้า
                    </button>
                  )}

                  {/* Edit Button (40px high) */}
                  <button
                    type="button"
                    onClick={() => onEditProduct(product)}
                    className="h-10 px-4 rounded-lg border border-zinc-700 hover:border-amber-500/60 bg-zinc-950 hover:bg-zinc-800 text-zinc-200 hover:text-amber-400 text-xs font-medium transition-colors cursor-pointer"
                  >
                    แก้ไข
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
