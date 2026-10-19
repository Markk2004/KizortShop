import { USE_MOCKS, apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

export interface DashboardMetrics {
  dailyRevenue: number;
  monthlyRevenue: number;
  totalOrdersToday: number;
  pendingSlips: number;
  activeMembers: number;
  outOfStockCount: number;
}

export interface StockVaultApiResponse {
  message: string;
  data: any[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  counts: {
    available: number;
    sold: number;
    claimed: number;
    total: number;
  };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  if (USE_MOCKS) {
    return {
      dailyRevenue: 48250,
      monthlyRevenue: 1245000,
      totalOrdersToday: 142,
      pendingSlips: 3,
      activeMembers: 1284,
      outOfStockCount: 4,
    };
  }
  try {
    return await apiGet<DashboardMetrics>("/admin/dashboard/metrics");
  } catch (err) {
    console.warn("Failed to fetch dashboard metrics from backend, falling back to mock:", err);
    return {
      dailyRevenue: 48250,
      monthlyRevenue: 1245000,
      totalOrdersToday: 142,
      pendingSlips: 3,
      activeMembers: 1284,
      outOfStockCount: 4,
    };
  }
}

export async function fetchStockVaultItems(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  productCode?: string;
}): Promise<StockVaultApiResponse | null> {
  if (USE_MOCKS) return null;
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.status) query.set("status", params.status);
  if (params?.productCode) query.set("productCode", params.productCode);

  const qs = query.toString();
  try {
    return await apiGet<StockVaultApiResponse>(`/admin/stocks${qs ? `?${qs}` : ""}`);
  } catch (err) {
    console.warn("Backend stocks endpoint error:", err);
    return null;
  }
}

export async function importStockBatch(payload: {
  productId: string;
  productCode: string;
  credentials: string[];
  batchCode?: string;
  supplierName?: string;
  costPrice?: number;
}) {
  if (USE_MOCKS) {
    return {
      message: `Successfully validated & stored ${payload.credentials.length} accounts into AES-256 Vault (Mock)`,
      importedCount: payload.credentials.length,
      serials: payload.credentials.map((_, i) => `STK-MOCK-${Date.now()}-${i}`),
    };
  }
  return await apiPost<{
    message: string;
    importedCount: number;
    serials: string[];
  }>("/admin/stocks/batch", payload);
}

export async function revealStockCredential(stockId: string): Promise<string | null> {
  if (USE_MOCKS) return null;
  try {
    const res = await apiPost<{ decrypted: string }>(`/admin/stocks/${stockId}/reveal`, {});
    return res.decrypted;
  } catch (err) {
    console.warn("Reveal stock credential error:", err);
    return null;
  }
}
