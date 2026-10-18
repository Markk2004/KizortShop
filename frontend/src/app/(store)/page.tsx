import { AnchorIsland } from "@/components/layout/AnchorIsland";
import { getCategories, getFeaturedProducts } from "@/features/catalog/api";
import { CategoryGrid } from "@/features/catalog/components/CategoryGrid";
import { ProductGrid } from "@/features/catalog/components/ProductGrid";
import { getLatestReviews, getRecentOrders, getStoreStats } from "@/features/home/api";
import { AnnouncementBar } from "@/features/home/components/AnnouncementBar";
import { HeroSection } from "@/features/home/components/HeroSection";
import { OrderTicker } from "@/features/home/components/OrderTicker";
import { QuickActions } from "@/features/home/components/QuickActions";
import { StatsGrid } from "@/features/home/components/StatsGrid";
import { ReviewGrid } from "@/features/reviews/components/ReviewGrid";

export default async function HomePage() {
  const [orders, stats, categories, products, reviews] = await Promise.all([
    getRecentOrders(),
    getStoreStats(),
    getCategories(),
    getFeaturedProducts(),
    getLatestReviews(),
  ]);

  return (
    <div className="relative">
      <AnchorIsland />
      <div className="pt-14 space-y-8">
        <OrderTicker orders={orders} />
        <HeroSection />
        <QuickActions />
        <StatsGrid stats={stats} />
        <CategoryGrid categories={categories} />
        <AnnouncementBar />
        <ProductGrid products={products} />
        <ReviewGrid reviews={reviews} />
      </div>
    </div>
  );
}
