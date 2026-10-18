import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Category } from "@/types";
import { CategoryCard } from "./CategoryCard";

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section id="section-categories" className="space-y-4">
      <SectionHeader
        eyebrow="GAME CATEGORIES"
        title="หมวดหมู่เกมยอดนิยม"
        subtitle="เลือกไอดีตามเกมที่ต้องการ พร้อมส่งมอบทันที 24 ชม."
        actionLabel="ดูทั้งหมด"
        actionHref="/products"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </section>
  );
}
