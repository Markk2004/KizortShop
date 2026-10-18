import { USE_MOCKS, apiGet } from "@/lib/api-client";
import { mockRecentOrders, mockReviews, mockStats } from "@/mocks/home";
import type { RecentOrder, Review, StoreStat } from "@/types";

export async function getRecentOrders(): Promise<RecentOrder[]> {
  if (USE_MOCKS) return mockRecentOrders;
  return apiGet<RecentOrder[]>("/orders/recent");
}

export async function getStoreStats(): Promise<StoreStat[]> {
  if (USE_MOCKS) return mockStats;
  return apiGet<StoreStat[]>("/stats");
}

export async function getLatestReviews(): Promise<Review[]> {
  if (USE_MOCKS) return mockReviews;
  return apiGet<Review[]>("/reviews?limit=3");
}
