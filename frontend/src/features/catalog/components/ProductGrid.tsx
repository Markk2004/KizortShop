import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <section id="section-products" className="space-y-4">
      <SectionHeader
        eyebrow="HOT INVENTORY"
        title="สินค้าแนะนำ ส่งออโต้ทันที"
        subtitle="คัดเฉพาะไอดีสเปกสูง ผ่านการตรวจสอบสิทธิ์เรียบร้อย"
        actionLabel="ดูทั้งหมด 44 รายการ"
        actionHref="/products"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
