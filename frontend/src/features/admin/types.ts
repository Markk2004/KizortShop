export interface AdminMetric {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  description: string;
}

export interface AdminProduct {
  id: string;
  code: string;
  title: string;
  category: string;
  price: number;
  stock: number;
  status: "ACTIVE" | "OUT_OF_STOCK" | "HIDDEN";
  totalSold: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  buyerUsername: string;
  productTitle: string;
  amount: number;
  paymentMethod: string;
  status: "COMPLETED" | "PENDING" | "REFUNDED";
  createdAt: string;
}

export interface AdminTopupVerification {
  id: string;
  username: string;
  amount: number;
  bank: string;
  slipReference: string;
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}
