// Shared DTO & entity contracts between frontend (Next.js) and backend (NestJS)

export type UserRole = "ADMIN" | "MEMBER";

export type ProductBadge = "BEST SELLER" | "HOT DEAL" | "NEW ITEM";

export type OrderStatus = "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED";

export type TopupStatus = "PENDING_VERIFY" | "SUCCESS" | "REJECTED";

export interface CategoryDto {
  id: string;
  name: string;
  description: string;
  image: string;
  itemCount: number;
  priceMin: number;
  priceMax: number;
  hot?: boolean;
  accent: "blue" | "sky" | "indigo" | "amber";
}

export interface ProductDto {
  id: string;
  code: string;
  title: string;
  image: string;
  tags: string[];
  price: number;
  originalPrice?: number;
  stock: number;
  badge?: ProductBadge;
  discountPercent?: number;
  categoryId: string;
}

export interface OrderSummaryDto {
  id: string;
  username: string;
  productName: string;
  amount: number;
  minutesAgo: number;
}

// Member-specific interfaces
export interface MemberProfileDto {
  id: string;
  username: string;
  email: string;
  balance: number;
  role: "MEMBER";
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
}

export interface MemberOrderHistoryDto {
  id: string;
  productTitle: string;
  productCode: string;
  credentials?: string;
  price: number;
  status: OrderStatus;
  purchasedAt: string;
}

// Admin-specific interfaces
export interface AdminMetricSummaryDto {
  dailyRevenue: number;
  monthlyRevenue: number;
  totalOrdersToday: number;
  pendingSlips: number;
  activeMembers: number;
  outOfStockItems: number;
}

export interface AdminProductManageDto extends ProductDto {
  salesCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTopupSlipDto {
  id: string;
  userId: string;
  username: string;
  amount: number;
  slipUrl: string;
  status: TopupStatus;
  submittedAt: string;
}
