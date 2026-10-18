"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Play, Plus, Sliders } from "lucide-react";
import { formatBaht } from "@/lib/format";
import type { AvailabilityCheckResult, AvailabilityStatus } from "@/types";
import {
  checkRobuxAvailability,
  getProductStatusOverrides,
  getRobuxServiceConfig,
  setProductAvailability,
  setRobuxServiceConfig,
  subscribeToInventoryChanges,
  type RobuxServiceConfig,
} from "@/features/catalog/services/inventoryCheck";

interface AdminProductRow {
  id: string;
  code: string;
  title: string;
  category: string;
  price: number;
  stock: number;
  status: AvailabilityStatus;
  sold: number;
}

const initialAdminProducts: AdminProductRow[] = [
  {
    id: "p-rbx-500",
    code: "RBX-500",
    title: "เติม Robux 500 R$ ระบบกลุ่มอัตโนมัติ ส่งเข้า ID ทันที",
    category: "เติม Robux อัตโนมัติ",
    price: 95,
    stock: 0,
    status: "OUT_OF_STOCK",
    sold: 520,
  },
  {
    id: "p-rbx-1000",
    code: "RBX-1000",
    title: "เติม Robux 1,000 R$ เรทพิเศษ คุ้มครองความปลอดภัย 100%",
    category: "เติม Robux อัตโนมัติ",
    price: 185,
    stock: 0,
    status: "OUT_OF_STOCK",
    sold: 940,
  },
  {
    id: "prod_01",
    code: "BF-V4-MAX-01",
    title: "ไก่ตัน Blox Fruits V4 เผ่าไซบอร์กหมัดก็อด ผลเสือตื่น",
    category: "Blox Fruits",
    price: 349,
    stock: 12,
    status: "AVAILABLE",
    sold: 142,
  },
  {
    id: "prod_02",
    code: "BF-CDK-MAX-02",
    title: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณฮาคิรุ้ง",
    category: "Blox Fruits",
    price: 490,
    stock: 5,
    status: "AVAILABLE",
    sold: 89,
  },
  {
    id: "prod_03",
    code: "AD-MYTHIC-03",
    title: "Anime Defenders Unit Mythic ลิมิเต็ด อัปเกรดดาวเต็ม",
    category: "Anime Defenders",
    price: 189,
    stock: 0,
    status: "OUT_OF_STOCK",
    sold: 67,
  },
];

export default function AdminProductsPage() {
  const [robuxConfig, setRobuxConfig] = useState<RobuxServiceConfig>(getRobuxServiceConfig());
  const [checkResult, setCheckResult] = useState<AvailabilityCheckResult | null>(null);
  const [products, setProducts] = useState<AdminProductRow[]>(initialAdminProducts);
  const [notification, setNotification] = useState<string | null>(null);

  // Load latest state and apply product overrides
  useEffect(() => {
    const refreshData = () => {
      const cfg = getRobuxServiceConfig();
      setRobuxConfig(cfg);

      const overrides = getProductStatusOverrides();
      setProducts((prev) =>
        prev.map((item) => {
          // If it's a Robux product, sync with main Robux service config
          if (item.category === "เติม Robux อัตโนมัติ") {
            return {
              ...item,
              status: cfg.status,
              stock: cfg.status === "OUT_OF_STOCK" ? 0 : 50,
            };
          }

          const ov = overrides[item.id];
          if (ov) {
            return {
              ...item,
              status: ov.status,
              stock: ov.stock,
            };
          }
          return item;
        }),
      );
    };

    refreshData();
    const unsubscribe = subscribeToInventoryChanges(refreshData);
    return () => unsubscribe();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Admin toggles Robux auto-topup availability
  const handleRobuxStatusChange = (newStatus: AvailabilityStatus) => {
    const updated = setRobuxServiceConfig({
      status: newStatus,
      stockCount: newStatus === "AVAILABLE" ? 10000 : 0,
      reason:
        newStatus === "OUT_OF_STOCK"
          ? "สินค้าหมดชั่วคราว ระบบปิดการเติม Robux อัตโนมัติชั่วคราว"
          : "บริการเติม Robux อัตโนมัติเปิดให้บริการตามปกติ",
    });
    setRobuxConfig(updated);

    // Also run check function immediately so admin sees the evaluated result
    const evaluated = checkRobuxAvailability();
    setCheckResult(evaluated);

    showNotification(
      `อัปเดตสถานะเติม Robux สำเร็จ: ${newStatus === "AVAILABLE" ? "มีสินค้า (เปิดให้บริการ)" : "สินค้าหมดชั่วคราว (ปิดระบบ)"}`,
    );
  };

  // Admin manually executes checkRobuxAvailability function
  const handleRunRobuxCheck = () => {
    const evaluated = checkRobuxAvailability();
    setCheckResult(evaluated);
    showNotification("ฟังก์ชัน checkRobuxAvailability() ทำงานสำเร็จ");
  };

  // Admin toggles individual product status between AVAILABLE and OUT_OF_STOCK
  const handleToggleProductStatus = (product: AdminProductRow) => {
    const newStatus: AvailabilityStatus =
      product.status === "AVAILABLE" ? "OUT_OF_STOCK" : "AVAILABLE";
    const newStock = newStatus === "AVAILABLE" ? (product.stock > 0 ? product.stock : 10) : 0;

    // If it's a robux product, update robux config directly
    if (product.category === "เติม Robux อัตโนมัติ") {
      handleRobuxStatusChange(newStatus);
      return;
    }

    setProductAvailability(product.id, newStatus, newStock);

    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, status: newStatus, stock: newStock } : p,
      ),
    );

    showNotification(
      `อัปเดต ${product.code}: ${newStatus === "AVAILABLE" ? "มีสินค้า" : "สินค้าหมดชั่วคราว"}`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            จัดการรายการสินค้าและระบบเติมเงิน (Products & Service Control)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ควบคุมสถานะการเปิด/ปิดบริการเติม Robux อัตโนมัติ และตั้งค่าสินค้าหมดชั่วคราว
          </p>
        </div>

        <button
          type="button"
          onClick={() => showNotification("เปิดแบบฟอร์มเพิ่มสินค้าใหม่ (ระบบรองรับ Phase 2)")}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มสินค้าใหม่</span>
        </button>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* SECTION 1: Robux Service Availability Controller */}
      <section className="luxury-card rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                การควบคุมบริการเติม Robux อัตโนมัติ (Robux Auto-Topup Controller)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              {'Admin สามารถตั้งค่าเปิด/ปิดสถานะ "มีสินค้า" หรือ "สินค้าหมดชั่วคราว" พร้อมฟังก์ชัน Check ตรวจสอบระบบ'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">สถานะปัจจุบัน:</span>
            {robuxConfig.status === "AVAILABLE" ? (
              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                มีสินค้า (พร้อมให้บริการ)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                สินค้าหมดชั่วคราว (ปิดระบบ)
              </span>
            )}
          </div>
        </div>

        {/* Status Selection Buttons */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">
            เลือกตั้งค่าสถานะบริการ Robux:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleRobuxStatusChange("OUT_OF_STOCK")}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                robuxConfig.status === "OUT_OF_STOCK"
                  ? "bg-red-500/10 border-red-500/40 text-white"
                  : "bg-obsidian-900 border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400">สินค้าหมดชั่วคราว (ปิดการใช้งาน)</span>
                {robuxConfig.status === "OUT_OF_STOCK" && (
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                ปิดการเติม Robux อัตโนมัติในหน้าแคตตาล็อก ปรับป้ายเป็นสินค้าหมดชั่วคราว และไม่อนุญาตให้กดสั่งซื้อ
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleRobuxStatusChange("AVAILABLE")}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                robuxConfig.status === "AVAILABLE"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                  : "bg-obsidian-900 border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">มีสินค้า (เปิดให้บริการ 24 ชม.)</span>
                {robuxConfig.status === "AVAILABLE" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                เปิดระบบเข้ากลุ่มส่ง Robux อัตโนมัติ ลูกค้าสามารถทำรายการและสั่งซื้อได้ทันที
              </p>
            </button>
          </div>
        </div>

        {/* Function Check Execution Box */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-white/[0.06] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>ฟังก์ชันตรวจสอบระบบ: checkRobuxAvailability()</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ทดสอบรันฟังก์ชันตรวจสอบสถานะความพร้อมของระบบเติม Robux แบบเรียลไทม์
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunRobuxCheck}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Play className="w-3 h-3 text-blue-400" />
              <span>รันคำสั่ง Check</span>
            </button>
          </div>

          {/* Diagnostic Result */}
          {checkResult && (
            <div className="p-3 rounded-lg bg-obsidian-950 border border-white/[0.08] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                <span className="text-slate-400">ผลการตรวจสอบ (Check Result):</span>
                <span className="text-[10px] text-slate-500">{checkResult.checkedAt}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Service: </span>
                  <span className="text-white">{checkResult.serviceName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Status: </span>
                  <span className={checkResult.isAvailable ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                    {checkResult.status} ({checkResult.statusLabel})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">isAvailable: </span>
                  <span className={checkResult.isAvailable ? "text-emerald-400" : "text-red-400"}>
                    {String(checkResult.isAvailable)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Stock Count: </span>
                  <span className="text-white num-tabular">{checkResult.stockCount} R$</span>
                </div>
              </div>
              <div className="pt-1 text-[11px] text-slate-300">
                <span className="text-slate-500">Message: </span>
                <span>{checkResult.message}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: General Products Table with Status Toggles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-wide">
            รายการสินค้าในร้านค้า (ปรับสถานะ มีสินค้า / สินค้าหมดชั่วคราว)
          </h2>
          <span className="text-xs text-slate-400">
            ทั้งหมด {products.length} รายการ
          </span>
        </div>

        <div className="luxury-card rounded-xl overflow-hidden border border-white/[0.08]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-obsidian-900 border-b border-white/[0.08] text-[11px] font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">รหัส / ชื่อสินค้า</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4">ราคาขาย</th>
                  <th className="py-3 px-4">สต็อก</th>
                  <th className="py-3 px-4">สถานะจำหน่าย</th>
                  <th className="py-3 px-4 text-right">ปรับสถานะ (Toggle)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {products.map((p) => {
                  const isAvailable = p.status === "AVAILABLE" && p.stock > 0;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[10px] text-slate-500 block">
                          {p.code}
                        </span>
                        <span className="font-medium text-white block">
                          {p.title}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{p.category}</td>
                      <td className="py-3.5 px-4 font-semibold text-white num-tabular">
                        {formatBaht(p.price)}
                      </td>
                      <td className="py-3.5 px-4 num-tabular font-medium">
                        {p.stock > 0 ? (
                          <span className="text-emerald-400">{p.stock} ชิ้น</span>
                        ) : (
                          <span className="text-red-400 font-semibold">0 ชิ้น</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isAvailable ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            มีสินค้า
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            สินค้าหมดชั่วคราว
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(p)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isAvailable
                              ? "bg-white/[0.06] hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-white/10"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white"
                          }`}
                        >
                          {isAvailable ? "ปรับเป็น สินค้าหมดชั่วคราว" : "ปรับเป็น มีสินค้า"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
