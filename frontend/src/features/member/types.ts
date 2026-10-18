export interface MemberProfile {
  id: string;
  username: string;
  email: string;
  balance: number;
  totalOrders: number;
  totalSpent: number;
  memberTier: "Standard" | "VIP" | "Diamond";
  joinedDate: string;
}

export interface MemberOrder {
  id: string;
  orderNumber: string;
  productName: string;
  gameCategory: string;
  amount: number;
  accountDetails?: string;
  status: "COMPLETED" | "PENDING" | "REFUNDED";
  createdAt: string;
}
