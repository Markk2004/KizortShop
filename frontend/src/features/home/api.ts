import { USE_MOCKS, apiGet } from "@/lib/api-client";
import { mockRecentOrders, mockReviews, mockStats } from "@/mocks/home";
import type { RecentOrder, Review, StoreStat } from "@/types";

export async function getRecentOrders(): Promise<RecentOrder[]> {
  if (USE_MOCKS) return mockRecentOrders;
  try {
    return await apiGet<RecentOrder[]>("/orders/recent");
  } catch {
    return mockRecentOrders;
  }
}

export async function getStoreStats(): Promise<StoreStat[]> {
  if (USE_MOCKS) return mockStats;
  try {
    return await apiGet<StoreStat[]>("/stats");
  } catch {
    return mockStats;
  }
}

export async function getLatestReviews(): Promise<Review[]> {
  if (USE_MOCKS) return mockReviews;
  try {
    return await apiGet<Review[]>("/reviews?limit=3");
  } catch {
    return mockReviews;
  }
}
