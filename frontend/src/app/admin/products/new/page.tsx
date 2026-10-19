"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AddProductDView } from "@/features/admin/components/graphite-amber/AddProductDView";

export default function NewProductPage() {
  const router = useRouter();

  return (
    <AddProductDView
      onBack={() => router.push("/admin/products")}
      onSaveProduct={(_prod) => {
        router.push("/admin/products");
      }}
    />
  );
}
