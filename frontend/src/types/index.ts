// Domain types. Mirror backend DTOs; move to packages/shared once the backend exists.

export type ProductBadge = "BEST SELLER" | "HOT DEAL" | "NEW ITEM";

export type AvailabilityStatus = "AVAILABLE" | "OUT_OF_STOCK";

export interface AvailabilityCheckResult {
  serviceId: string;
  serviceName: string;
  isAvailable: boolean;
  status: AvailabilityStatus;
  statusLabel: string;
  stockCount: number;
  message: string;
  checkedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  itemCount: number;
  priceMin: number;
  priceMax: number;
  hot?: boolean;
  accent: "blue" | "sky" | "indigo" | "amber";
  status?: AvailabilityStatus;
  isOutOfStock?: boolean;
}

export interface Product {
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
  status?: AvailabilityStatus;
}

export interface Review {
  id: string;
  username: string;
  productName: string;
  rating: number;
  comment: string;
}

export interface RecentOrder {
  id: string;
  username: string;
  productName: string;
  amount: number;
  minutesAgo: number;
}

export interface StoreStat {
  id: string;
  label: string;
  value: string;
  note: string;
  noteTone?: "positive" | "neutral";
}
