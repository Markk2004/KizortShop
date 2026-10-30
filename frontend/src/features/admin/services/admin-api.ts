import { USE_MOCKS, apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

export interface DailyBar {
  day: string;
  label: string;
  val: number;
  valLabel: string;
  heightPercent: number;
  isToday?: boolean;
}

export interface DashboardMetrics {
  dailyRevenue: number;
  yesterdayRevenue?: number;
  revenueChangePercent?: number;
  weeklyRevenue?: number;
  monthlyRevenue: number;
  totalRevenue?: number;
  totalOrdersToday: number;
  soldTotalCount?: number;
  availableStockCount?: number;
  defectiveCount?: number;
  openTicketsCount?: number;
  pendingSlips: number;
  pendingSlipsAmount?: number;
  activeMembers: number;
  outOfStockCount: number;
  outOfStockProducts?: string[];
  weeklyBars?: DailyBar[];
}

export interface AccountingData {
  summary: {
    totalRevenue: number;
    totalCost: number;
    operatingExpenses?: number;
    netProfit: number;
    profitMargin: number;
    defectLoss: number;
    inventoryCost: number;
    potentialRevenue: number;
    pricedAvailableCount?: number;
    unpricedAvailableCount?: number;
    avgSoldPrice?: number;
    estimatedInventoryValue?: number;
    soldCount: number;
    availableCount: number;
    defectiveCount: number;
    totalItems: number;
  };
  breakdownByMap: Array<{
    mapName: string;
    soldCount: number;
    availableCount: number;
    revenue: number;
    cost: number;
    profit: number;
  }>;
  recentSales: Array<{
    id: string;
    serialCode: string;
    username: string;
    productTitle: string;
    map: string;
    sellingPrice: number;
    cost: number;
    profit: number;
    soldAt: string;
    orderNumber?: string;
  }>;
}

export async function fetchAccountingData(): Promise<AccountingData | null> {
  try {
    return await apiGet<AccountingData>("/admin/dashboard/accounting");
  } catch (err) {
    console.warn("Failed to fetch accounting data:", err);
    return null;
  }
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
  try {
    return await apiGet<DashboardMetrics>("/admin/dashboard/metrics");
  } catch (err) {
    console.warn("Failed to fetch dashboard metrics from backend, using safe zero fallback:", err);
    return {
      dailyRevenue: 0,
      yesterdayRevenue: 0,
      revenueChangePercent: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
      totalOrdersToday: 0,
      soldTotalCount: 0,
      availableStockCount: 0,
      defectiveCount: 0,
      openTicketsCount: 0,
      pendingSlips: 0,
      pendingSlipsAmount: 0,
      activeMembers: 0,
      outOfStockCount: 0,
      outOfStockProducts: [],
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

// ==================== CATEGORIES API ====================

export interface AdminCategoryApiResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  badge?: string;
  sortOrder?: number;
  itemCount: number;
  priceMin: number;
  priceMax: number;
  accent?: string;
  status: "AVAILABLE" | "OUT_OF_STOCK";
  isActive: boolean;
}

export async function fetchAdminCategories(): Promise<AdminCategoryApiResponse[]> {
  const res = await apiGet<{ message: string; data: AdminCategoryApiResponse[] }>("/admin/categories");
  return res.data;
}

export async function createAdminCategory(payload: {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
}): Promise<AdminCategoryApiResponse> {
  const res = await apiPost<{ message: string; data: AdminCategoryApiResponse }>("/admin/categories", payload);
  return res.data;
}

export async function updateAdminCategory(
  id: string,
  payload: {
    name?: string;
    slug?: string;
    description?: string;
    image?: string;
    isActive?: boolean;
  }
): Promise<AdminCategoryApiResponse> {
  const res = await apiPatch<{ message: string; data: AdminCategoryApiResponse }>(`/admin/categories/${id}`, payload);
  return res.data;
}

export async function deleteAdminCategory(id: string): Promise<{ id: string }> {
  const res = await apiDelete<{ message: string; data: { id: string } }>(`/admin/categories/${id}`);
  return res.data;
}

// ==================== PRODUCTS API ====================

export interface AdminProductApiResponse {
  id: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  categoryId?: string;
  categorySlug?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  status: "AVAILABLE" | "OUT_OF_STOCK";
  sold?: number;
  badge?: string;
  image?: string;
}

export async function fetchAdminProducts(): Promise<AdminProductApiResponse[]> {
  const res = await apiGet<{ message: string; data: AdminProductApiResponse[] }>("/admin/products");
  return res.data;
}

export async function createAdminProduct(payload: {
  code?: string;
  title: string;
  description?: string;
  categoryId: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  image?: string;
  credentials?: string[];
}): Promise<AdminProductApiResponse> {
  const res = await apiPost<{ message: string; data: AdminProductApiResponse }>("/admin/products", payload);
  return res.data;
}

export async function updateAdminProduct(
  id: string,
  payload: {
    code?: string;
    title?: string;
    description?: string;
    categoryId?: string;
    price?: number;
    originalPrice?: number;
    badge?: string;
    isActive?: boolean;
    status?: "AVAILABLE" | "OUT_OF_STOCK";
    stock?: number;
    credentials?: string[];
  }
): Promise<AdminProductApiResponse> {
  const res = await apiPatch<{ message: string; data: AdminProductApiResponse }>(`/admin/products/${id}`, payload);
  return res.data;
}

export async function deleteAdminProduct(id: string): Promise<{ id: string }> {
  const res = await apiDelete<{ message: string; data: { id: string } }>(`/admin/products/${id}`);
  return res.data;
}

// ==================== ORDERS API ====================

export interface AdminOrderApiResponse {
  id: string;
  orderNumber: string;
  buyer: string;
  buyerEmail?: string;
  productTitle: string;
  categoryCode: string;
  deliveredCode: string;
  decryptedCredential?: string;
  amount: number;
  status: "COMPLETED" | "PENDING" | "REFUNDED" | "FAILED";
  sla: string;
  timeAgo: string;
  warrantyExpiresIn?: string;
  createdAt: string;
}

export async function fetchAdminOrders(): Promise<AdminOrderApiResponse[]> {
  try {
    const res = await apiGet<{ message: string; data: AdminOrderApiResponse[] }>("/admin/orders");
    return res.data;
  } catch (err) {
    console.warn("Failed to fetch admin orders:", err);
    return [];
  }
}

export async function updateAdminOrderStatus(id: string, status: string): Promise<any> {
  return await apiPatch(`/admin/orders/${id}/status`, { status });
}

// ==================== USERS API ====================

export interface AdminUserApiResponse {
  id: string;
  username: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  tier: "Standard" | "VIP" | "Diamond";
  balance: number;
  status: "ACTIVE" | "BANNED";
  registeredAt: string;
  totalOrders: number;
}

export async function fetchAdminUsers(): Promise<AdminUserApiResponse[]> {
  try {
    const res = await apiGet<{ message: string; data: AdminUserApiResponse[] }>("/admin/users");
    return res.data;
  } catch (err) {
    console.warn("Failed to fetch admin users:", err);
    return [];
  }
}

export async function adjustUserBalance(id: string, amount: number, reason?: string): Promise<any> {
  return await apiPatch(`/admin/users/${id}/balance`, { amount, reason });
}

export async function updateUserRole(id: string, role: "MEMBER" | "ADMIN"): Promise<any> {
  return await apiPatch(`/admin/users/${id}/role`, { role });
}

export async function updateUserStatus(id: string, status: "ACTIVE" | "BANNED"): Promise<any> {
  return await apiPatch(`/admin/users/${id}/status`, { status });
}

export async function createAdminUser(payload: {
  username: string;
  email: string;
  role?: "MEMBER" | "ADMIN";
  balance?: number;
  tier?: string;
}): Promise<any> {
  return await apiPost("/admin/users", payload);
}

// ==================== TOPUPS API ====================

export interface AdminTopupApiResponse {
  id: string;
  user: string;
  amount: number;
  bank: string;
  time: string;
  ref: string;
  status: "PENDING_VERIFY" | "SUCCESS" | "REJECTED";
}

export async function fetchAdminTopups(): Promise<AdminTopupApiResponse[]> {
  try {
    const res = await apiGet<any[]>("/payments/topup");
    return res.map((t) => ({
      id: t.id,
      user: t.user?.username || "ลูกค้า",
      amount: Number(t.amount),
      bank: t.paymentMethod || "PROMPTPAY",
      time: new Date(t.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
      ref: t.slipRef || t.transactionCode || t.id.slice(0, 8),
      status: t.status,
    }));
  } catch (err) {
    console.warn("Failed to fetch admin topups:", err);
    return [];
  }
}

export async function verifyTopupTransaction(
  id: string,
  status: "SUCCESS" | "REJECTED",
  verifiedBy: string = "Admin",
  reason?: string,
): Promise<any> {
  return await apiPost(`/payments/topup/${id}/verify`, { status, verifiedBy, reason });
}


