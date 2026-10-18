import { Star } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Review } from "@/types";

export function ReviewGrid({ reviews }: { reviews: Review[] }) {
  return (
    <section id="section-reviews" className="space-y-4 pt-2 pb-4 scroll-mt-32">
      <SectionHeader
        title="รีวิวจากผู้ใช้บริการ"
        subtitle="ความคิดเห็นจริงจากผู้ซื้อที่ยืนยันสิทธิ์"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reviews.map((review) => (
          <div key={review.id} className="luxury-card rounded-xl p-4 space-y-2.5">
            <div className="flex gap-1 text-amber-400">
              {Array.from({ length: review.rating }).map((_, idx) => (
                <Star key={idx} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              &ldquo;{review.comment}&rdquo;
            </p>
            <div className="text-[11px] text-slate-500 pt-2 border-t border-white/[0.06] flex justify-between">
              <span className="text-slate-300 font-medium">{review.username}</span>
              <span>{review.productName}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
