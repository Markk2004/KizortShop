"use client";

import React, { useState } from "react";
import {
  ProductsDView,
  type GraphiteProduct,
} from "@/features/admin/components/graphite-amber/ProductsDView";
import { AddProductDView } from "@/features/admin/components/graphite-amber/AddProductDView";
import { HardConfirmModal } from "@/features/admin/components/HardConfirmModal";
import { useToast } from "@/common/components/ToastProvider";

const initialProducts: GraphiteProduct[] = [
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
    code: "BF-CDK-02",
    title: "ไอดีดาบคู่โอเด้ง Cursed Dual Katana + เคียววิญญาณฮาคิรุ้ง",
    category: "Blox Fruits",
    price: 490,
    stock: 5,
    status: "AVAILABLE",
    sold: 89,
  },
  {
    id: "prod_03",
    code: "AD-MYT-01",
    title: "Anime Defenders Unit Mythic ลิมิเต็ด อัปเกรดดาวเต็ม",
    category: "Anime Defenders",
    price: 189,
    stock: 3,
    status: "AVAILABLE",
    sold: 67,
  },
  {
    id: "prod_04",
    code: "BF-KIT-04",
    title: "ไอดี Blox Fruits ผลจิ้งจอกเก้าหาง Kitsune ถาวร + หมัด Sanguine Art",
    category: "Blox Fruits",
    price: 890,
    stock: 0,
    status: "OUT_OF_STOCK",
    sold: 54,
  },
  {
    id: "prod_05",
    code: "AD-SEC-05",
    title: "Anime Defenders ไอดีพร้อมตัวละคร Secret Dragon Mage",
    category: "Anime Defenders",
    price: 650,
    stock: 0,
    status: "OUT_OF_STOCK",
    sold: 23,
  },
];

export default function AdminProductsPage() {
  const { success, warning, info } = useToast();
  const [viewMode, setViewMode] = useState<"LIST" | "ADD" | "EDIT">("LIST");
  const [products, setProducts] = useState<GraphiteProduct[]>(initialProducts);
  const [selectedProduct, setSelectedProduct] = useState<GraphiteProduct | null>(null);

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
        onConfirm: () => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, status: "OUT_OF_STOCK", stock: 0 } : p
            )
          );
          setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
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
        onConfirm: () => {
          const nextStock = product.stock > 0 ? product.stock : 10;
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, status: "AVAILABLE", stock: nextStock } : p
            )
          );
          setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
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

  const handleSaveProduct = (savedProduct: GraphiteProduct) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProduct.id);
      if (exists) {
        return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
      }
      return [savedProduct, ...prev];
    });

    setViewMode("LIST");
    success(
      `บันทึกข้อมูลสินค้าสำเร็จ`,
      `สินค้า ${savedProduct.code} ถูกอัปเดตเข้าสู่ระบบเรียบร้อยแล้ว`
    );
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
