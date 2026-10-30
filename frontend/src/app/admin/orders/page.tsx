"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { AdminPagination } from "@/features/admin/components/AdminPagination";
import {
  OrderDetailDrawer,
  type OrderDrawerData,
} from "@/features/admin/components/OrderDetailDrawer";
import {
  AdminSmartFilterBar,
  verifySearchInput,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";
import { HardConfirmModal } from "@/features/admin/components/HardConfirmModal";
import { useToast } from "@/common/components/ToastProvider";
import { formatBaht } from "@/lib/format";
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
} from "@/features/admin/services/admin-api";

export default function AdminOrdersPage() {
  const { success, warning, info } = useToast();
  const [orders, setOrders] = useState<OrderDrawerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "COMPLETED" | "PENDING" | "REFUNDED"
  >("ALL");
  const [selectedOrder, setSelectedOrder] = useState<OrderDrawerData | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminOrders();
      if (data && data.length > 0) {
        setOrders(
          data.map((item) => ({
            id: item.id,
            orderNumber: item.orderNumber,
            buyer: item.buyer,
            buyerEmail: item.buyerEmail || "customer@kaizort.store",
            productTitle: item.productTitle,
            categoryCode: item.categoryCode,
            deliveredCode: item.deliveredCode,
            decryptedCredential: item.decryptedCredential || "●●●●●●●●",
            amount: item.amount,
            status: item.status as any,
            sla: item.sla || "0.8 วิ",
            timeAgo: item.timeAgo,
            warrantyExpiresIn: item.warrantyExpiresIn || "รับประกัน 24 ชม.",
          })),
        );
      }
    } catch (err) {
      console.warn("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // 2-Step Hard Confirmation Modal State
  const [hardConfirmConfig, setHardConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    targetItemName?: string;
    expectedKeyword?: string;
    confirmLabel?: string;
    variant?: "danger" | "warning" | "amber";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const handleToggleRefund = (order: OrderDrawerData) => {
    const isRefunding = order.status !== "REFUNDED";

    if (isRefunding) {
      // Critical Action: Refunding money back to wallet requires 2-step confirmation
      setHardConfirmConfig({
        isOpen: true,
        title: "ยืนยันการคืนเงินเคลมเข้ากระเป๋าเงินลูกค้า (Refund)",
        description: `ระบบจะดำเนินการยกเลิกคำสั่งซื้อ และโอนเงินคืนจำนวน ${formatBaht(order.amount)} กลับเข้ากระเป๋าเครดิตของผู้ซื้อ (@${order.buyer}) ทันที การกระทำนี้ไม่สามารถย้อนกลับได้`,
        targetItemName: `ออเดอร์ #${order.orderNumber} (${formatBaht(order.amount)})`,
        expectedKeyword: "REFUND",
        confirmLabel: "ยืนยันการคืนเงินเต็มจำนวน",
        variant: "danger",
        onConfirm: async () => {
          setOrders((prev) =>
            prev.map((o) => (o.id === order.id ? { ...o, status: "REFUNDED" } : o)),
          );
          setSelectedOrder((prev) =>
            prev && prev.id === order.id ? { ...prev, status: "REFUNDED" } : prev,
          );
          setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          await updateAdminOrderStatus(order.id, "REFUNDED").catch(() => {});
          warning(
            `คืนเงินเคลมสำเร็จ`,
            `โอนเงินคืนจำนวน ${formatBaht(order.amount)} ให้ออเดอร์ #${order.orderNumber} เข้ากระเป๋าผู้ซื้อแล้ว`
          );
        },
      });
    } else {
      // Revert Refund
      setHardConfirmConfig({
        isOpen: true,
        title: "ยืนยันการยกเลิกสถานะคืนเงิน",
        description: `ต้องการปรับสถานะออเดอร์ #${order.orderNumber} กลับเป็นสำเร็จ (COMPLETED) หรือไม่?`,
        targetItemName: `ออเดอร์ #${order.orderNumber}`,
        expectedKeyword: "REVERT",
        confirmLabel: "เปลี่ยนสถานะกลับ",
        variant: "warning",
        onConfirm: () => {
          setOrders((prev) =>
            prev.map((o) => (o.id === order.id ? { ...o, status: "COMPLETED" } : o)),
          );
          setSelectedOrder((prev) =>
            prev && prev.id === order.id ? { ...prev, status: "COMPLETED" } : prev,
          );
          setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          info(
            `อัปเดตสถานะคำสั่งซื้อ`,
            `ออเดอร์ #${order.orderNumber} กลับสู่สถานะ COMPLETED เรียบร้อย`
          );
        },
      });
    }
  };

  const handleReplaceStock = (order: OrderDrawerData) => {
    setHardConfirmConfig({
      isOpen: true,
      title: "ยืนยันการเปลี่ยนไอดีเคลมใหม่ (Claim Replacement)",
      description: `ระบบจะทำการดึงรหัสสต็อกสำรองใหม่ส่งมอบแทนรหัสเดิม (${order.deliveredCode}) ให้แก่ลูกค้าทันที`,
      targetItemName: `ออเดอร์ #${order.orderNumber} — ${order.productTitle}`,
      expectedKeyword: "REPLACE",
      confirmLabel: "ส่งมอบไอดีเคลมใหม่",
      variant: "amber",
      onConfirm: () => {
        const newSerial = `STK-CLAIM-${Math.floor(1000 + Math.random() * 9000)}`;
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, deliveredCode: newSerial } : o,
          ),
        );
        setSelectedOrder((prev) =>
          prev && prev.id === order.id
            ? { ...prev, deliveredCode: newSerial }
            : prev,
        );
        setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        success(
          `เปลี่ยนไอดีเคลมใหม่สำเร็จ`,
          `ส่งมอบรหัสสต็อกใหม่ (${newSerial}) ให้คำสั่งซื้อ #${order.orderNumber} เรียบร้อย`
        );
      },
    });
  };

  const verification = verifySearchInput(searchQuery, searchMode);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (!verification.isValid) return false;

    if (searchMode === "ORDER_ID") {
      return o.orderNumber.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    }
    if (searchMode === "SKU_CODE") {
      return (
        o.categoryCode.toLowerCase().includes(q) ||
        o.deliveredCode.toLowerCase().includes(q)
      );
    }
    if (searchMode === "USERNAME") {
      return (
        o.buyer.toLowerCase().includes(q) ||
        (o.buyerEmail ? o.buyerEmail.toLowerCase().includes(q) : false)
      );
    }
    if (searchMode === "NUMBER_PRICE") {
      return String(o.amount).includes(q);
    }

    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.buyer.toLowerCase().includes(q) ||
      o.productTitle.toLowerCase().includes(q) ||
      o.categoryCode.toLowerCase().includes(q) ||
      o.deliveredCode.toLowerCase().includes(q) ||
      String(o.amount).includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 block mb-1">
            KZ // ORDER AUDIT & ESCROW LOG
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            คำสั่งซื้อทั้งหมดในระบบ (Orders Monitor & Drawer Inspector)
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            คลิกที่แถวคำสั่งซื้อหรือปุ่ม &ldquo;ดูข้อมูล&rdquo; เพื่อเปิด Drawer ตรวจสอบรหัสสินค้าและสถานะประกัน 24 ชม.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">TOTAL ORDERS:</span>
          <span className="px-3.5 py-1.5 rounded-md text-sm font-mono font-bold text-zinc-950 bg-white num-tabular">
            {orders.length} ORDERS
          </span>
        </div>
      </div>

      {/* Smart Filter & Search Verification Bar */}
      <AdminSmartFilterBar
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
        searchMode={searchMode}
        onSearchModeChange={(m) => {
          setSearchMode(m);
          setCurrentPage(1);
        }}
        placeholder="ค้นหาเลขออเดอร์ (KZ-99412), ผู้ซื้อ, รหัสสต็อก หรือราคา..."
        totalMatched={filteredOrders.length}
        totalAll={orders.length}
      >
        <div className="flex p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono">
          {(["ALL", "COMPLETED", "PENDING", "REFUNDED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-white text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </AdminSmartFilterBar>

      {/* Table + Pagination (Readable 14px Typography) */}
      <div className="rounded-xl overflow-hidden bg-obsidian-900 border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-200">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-xs font-mono uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="py-3.5 px-5">ORDER ID</th>
                <th className="py-3.5 px-5">BUYER</th>
                <th className="py-3.5 px-5">PRODUCT // STOCK SERIAL</th>
                <th className="py-3.5 px-5">AMOUNT</th>
                <th className="py-3.5 px-5">TIME</th>
                <th className="py-3.5 px-5">STATUS</th>
                <th className="py-3.5 px-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-400 text-sm">
                    ไม่พบรายการคำสั่งซื้อที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    className="hover:bg-zinc-800/35 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-5 font-mono font-bold text-white text-sm">
                      #{o.orderNumber}
                    </td>
                    <td className="py-4 px-5 font-mono text-zinc-200 text-sm">
                      @{o.buyer}
                    </td>
                    <td className="py-4 px-5">
                      <span className="text-white font-semibold block max-w-md truncate text-sm">
                        {o.productTitle}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs">
                          {o.categoryCode}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          SERIAL: {o.deliveredCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-white text-base num-tabular">
                      {formatBaht(o.amount)}
                    </td>
                    <td className="py-4 px-5 font-mono text-zinc-400 text-xs">
                      {o.timeAgo}
                    </td>
                    <td className="py-4 px-5">
                      {o.status === "COMPLETED" && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          COMPLETED
                        </span>
                      )}
                      {o.status === "PENDING" && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PENDING
                        </span>
                      )}
                      {o.status === "REFUNDED" && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                          REFUNDED
                        </span>
                      )}
                    </td>
                    <td
                      className="py-4 px-5 text-right whitespace-nowrap space-x-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดูข้อมูล</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleRefund(o)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>
                          {o.status === "REFUNDED" ? "คืนสถานะ" : "คืนเงิน"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          currentPage={safePage}
          totalItems={filteredOrders.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="คำสั่งซื้อ"
        />
      </div>

      {/* 2-Step Hard Confirmation Modal */}
      <HardConfirmModal
        isOpen={hardConfirmConfig.isOpen}
        title={hardConfirmConfig.title}
        description={hardConfirmConfig.description}
        targetItemName={hardConfirmConfig.targetItemName}
        expectedKeyword={hardConfirmConfig.expectedKeyword}
        confirmLabel={hardConfirmConfig.confirmLabel}
        variant={hardConfirmConfig.variant}
        onConfirm={hardConfirmConfig.onConfirm}
        onCancel={() => setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ORDER DETAIL DRAWER */}
      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onResendDm={(ord) =>
          success(
            "ส่งรหัสซ้ำเข้า Discord DM สำเร็จ",
            `จัดส่งข้อมูลไอดีและรหัสผ่านสำหรับออเดอร์ #${ord.orderNumber} ไปยัง DM ของ @${ord.buyer} เรียบร้อยแล้ว`
          )
        }
        onToggleRefund={handleToggleRefund}
        onReplaceStock={handleReplaceStock}
      />
    </div>
  );
}
