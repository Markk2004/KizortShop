import { Suspense } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCategories, getProducts } from "@/features/catalog/api";
import { CategoryCard } from "@/features/catalog/components/CategoryCard";
import { ProductCard } from "@/features/catalog/components/ProductCard";

async function ProductCatalogContent({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const selectedCategory = params?.category;

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(selectedCategory),
  ]);

  return (
    <div className="pt-6 space-y-8">
      <section className="space-y-4">
        <SectionHeader
          eyebrow="ALL CATEGORIES"
          title="หมวดหมู่เกมทั้งหมด"
          subtitle="เลือกหมวดหมู่ที่ต้องการดูรายการสินค้า"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </section>

      <section className="space-y-4 pb-6">
        <SectionHeader
          eyebrow="CATALOG"
          title={
            selectedCategory === "robux"
              ? "รายการเติม Robux อัตโนมัติ"
              : "รายการสินค้าพร้อมจำหน่าย"
          }
          subtitle={
            selectedCategory === "robux"
              ? "สถานะสินค้าในหมวดหมู่นี้: สินค้าหมดชั่วคราว"
              : "ส่งมอบข้อมูลไอดีอัตโนมัติทันทีหลังชำระเงิน"
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          กำลังโหลดรายการสินค้าและหมวดหมู่...
        </div>
      }
    >
      <ProductCatalogContent searchParams={searchParams} />
    </Suspense>
  );
}
