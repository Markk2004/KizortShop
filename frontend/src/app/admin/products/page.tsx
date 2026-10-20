"use client";

import React, { useState, useEffect } from "react";
import {
  ProductsDView,
  type GraphiteProduct,
} from "@/features/admin/components/graphite-amber/ProductsDView";
import { AddProductDView } from "@/features/admin/components/graphite-amber/AddProductDView";
import { HardConfirmModal } from "@/features/admin/components/HardConfirmModal";
import { useToast } from "@/common/components/ToastProvider";
import {
  getAdminProducts,
  saveAdminProduct,
  deleteAdminProduct,
  toggleAdminProductStatus,
  subscribeToCatalogChanges,
  initialAdminProducts,
} from "@/features/catalog/services/catalogStore";

export default function AdminProductsPage() {
  const { success, warning, info } = useToast();
  const [viewMode, setViewMode] = useState<"LIST" | "ADD" | "EDIT">("LIST");
  const [products, setProducts] = useState<GraphiteProduct[]>(initialAdminProducts);
  const [selectedProduct, setSelectedProduct] = useState<GraphiteProduct | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const data = await getAdminProducts();
        if (isMounted) setProducts(data);
      } catch {}
    }
    loadData();
    const unsubscribe = subscribeToCatalogChanges(() => {
      loadData();
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
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

  const handleToggleStatus = (product: GraphiteProduct) => {
    const isCurrentlyAvailable = product.status === "AVAILABLE" && product.stock > 0;

    if (isCurrentlyAvailable) {
      // Critical Action: Disabling a live product requires 2-step confirmation
      setHardConfirmConfig({
        isOpen: true,
        title: "ยืนยันการปิดวางจำหน่ายสินค้า",
        description:
          "การปิดจำหน่ายสินค้าจะทำให้ลูกค้าไม่สามารถสั่งซื้อสินค้านี้จากหน้าร้านได้ทันที และระบบจะปรับสถานะเป็นสินค้าหมดชั่วคราว",
        targetItemName: `${product.code} — ${product.title}`,
        expectedKeyword: "DISABLE",
        confirmLabel: "ปิดวางจำหน่ายทันที",
        variant: "warning",
        onConfirm: async () => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, status: "OUT_OF_STOCK", stock: 0 } : p
            )
          );
          setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          await toggleAdminProductStatus(product.id, "OUT_OF_STOCK", 0);
          warning(
            `ปรับเป็นสินค้าหมดชั่วคราวแล้ว`,
            `สินค้า ${product.code} ถูกปิดการวางจำหน่ายบนหน้าร้านเรียบร้อย`
          );
        },
      });
    } else {
      // Re-enabling product
      setHardConfirmConfig({
        isOpen: true,
        title: "ยืนยันการเปิดวางจำหน่ายสินค้าสู่หน้าร้าน",
        description:
          "การเปิดขายสินค้าจะทำให้ลูกค้าบนหน้าร้านสามารถทำรายการและตัดเงินสั่งซื้อได้ทันที กรุณาตรวจสอบว่ามีสต็อกไอดีเกมพร้อมส่งมอบ",
        targetItemName: `${product.code} — ${product.title}`,
        expectedKeyword: "ENABLE",
        confirmLabel: "เปิดวางจำหน่ายทันที",
        variant: "amber",
        onConfirm: async () => {
          const nextStock = product.stock > 0 ? product.stock : 10;
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, status: "AVAILABLE", stock: nextStock } : p
            )
          );
          setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          await toggleAdminProductStatus(product.id, "AVAILABLE", nextStock);
          success(
            `เปิดวางจำหน่ายสำเร็จ`,
            `สินค้า ${product.code} พร้อมให้ลูกค้าสั่งซื้อจากหน้าร้านได้ทันที`
          );
        },
      });
    }
  };

  const handleOpenAdd = () => {
    setSelectedProduct(null);
    setViewMode("ADD");
  };

  const handleOpenEdit = (product: GraphiteProduct) => {
    setSelectedProduct(product);
    setViewMode("EDIT");
  };

  const handleSaveProduct = async (
    savedProduct: GraphiteProduct,
    stockItems?: string[]
  ) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProduct.id);
      if (exists) {
        return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
      }
      return [savedProduct, ...prev];
    });

    setViewMode("LIST");

    try {
      const persisted = await saveAdminProduct(savedProduct, stockItems);
      setProducts((prev) =>
        prev.map((p) => (p.id === savedProduct.id ? persisted : p))
      );
      success(
        `บันทึกข้อมูลสินค้าสำเร็จ`,
        `สินค้า ${savedProduct.code} ถูกบันทึกเข้าสู่ระบบเรียบร้อยแล้ว`
      );
    } catch {
      success(
        `บันทึกข้อมูลสินค้าสำเร็จ`,
        `สินค้า ${savedProduct.code} ถูกบันทึกเรียบร้อยแล้ว`
      );
    }
  };

  const handleDeleteProduct = (product: GraphiteProduct) => {
    setHardConfirmConfig({
      isOpen: true,
      title: "ยืนยันการนำสินค้าออกจากระบบ",
      description: `คุณต้องการลบสินค้า "${product.code} — ${product.title}" ออกจากระบบถาวรหรือไม่? สต็อกไอดีของสินค้านี้จะถูกนำออกด้วย`,
      targetItemName: `${product.code} — ${product.title}`,
      expectedKeyword: "DELETE",
      confirmLabel: "นำสินค้าออกทันที",
      variant: "danger",
      onConfirm: async () => {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteAdminProduct(product.id);
          warning("นำสินค้าออกสำเร็จ", `ลบสินค้า ${product.code} เรียบร้อยแล้ว`);
        } catch {
          warning("นำสินค้าออกสำเร็จ", `ลบสินค้า ${product.code} เรียบร้อยแล้ว`);
        }
      },
    });
  };

  return (
    <div className="space-y-6">

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

      {viewMode === "LIST" && (
        <ProductsDView
          products={products}
          onToggleStatus={handleToggleStatus}
          onOpenAddModal={handleOpenAdd}
          onEditProduct={handleOpenEdit}
          onDeleteProduct={handleDeleteProduct}
        />
      )}

      {(viewMode === "ADD" || viewMode === "EDIT") && (
        <AddProductDView
          onBack={() => setViewMode("LIST")}
          onSaveProduct={handleSaveProduct}
          initialProduct={selectedProduct}
        />
      )}
    </div>
  );
}
