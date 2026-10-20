"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AddProductDView } from "@/features/admin/components/graphite-amber/AddProductDView";
import { saveAdminProduct } from "@/features/catalog/services/catalogStore";
import { useToast } from "@/common/components/ToastProvider";

export default function NewProductPage() {
  const router = useRouter();
  const { success } = useToast();

  return (
    <AddProductDView
      onBack={() => router.push("/admin/products")}
      onSaveProduct={async (prod, stockItems) => {
        try {
          await saveAdminProduct(prod, stockItems);
          success("บันทึกสินค้าสำเร็จ", `เพิ่มสินค้า ${prod.code} เรียบร้อยแล้ว`);
        } catch {
          success("บันทึกสินค้าสำเร็จ", `เพิ่มสินค้า ${prod.code} เรียบร้อยแล้ว`);
        }
        router.push("/admin/products");
      }}
    />
  );
}
