import { USE_MOCKS, apiGet } from "@/lib/api-client";
import { mockRecentOrders, mockReviews, mockStats } from "@/mocks/home";
import type { RecentOrder, Review, StoreStat } from "@/types";

export async function getRecentOrders(): Promise<RecentOrder[]> {
  if (USE_MOCKS) return mockRecentOrders;
  try {
    const data = await apiGet<RecentOrder[]>("/orders/recent");
    return Array.isArray(data) && data.length > 0 ? data : mockRecentOrders;
  } catch {
    return mockRecentOrders;
  }
}

export async function getStoreStats(): Promise<StoreStat[]> {
  if (USE_MOCKS) return mockStats;
  try {
    const data = await apiGet<StoreStat[]>("/stats");
    return Array.isArray(data) && data.length > 0 ? data : mockStats;
  } catch {
    return mockStats;
  }
}

export async function getLatestReviews(): Promise<Review[]> {
  if (USE_MOCKS) return mockReviews;
  try {
    const data = await apiGet<Review[]>("/reviews?limit=3");
    return Array.isArray(data) && data.length > 0 ? data : mockReviews;
  } catch {
    return mockReviews;
  }
}
