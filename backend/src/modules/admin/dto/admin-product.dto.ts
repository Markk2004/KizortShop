export type StockMode = "POOL" | "UNIQUE_1TO1";
export type CredentialFormat = "USER_PASS" | "USER_PASS_2FA" | "COOKIE_TOKEN" | "REDEEM_KEY";
export type StockStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "CLAIMED_DEFECTIVE";

export class CreateAdminProductDto {
  code: string;
  title: string;
  description?: string;
  categoryId: string;
  price: number;
  originalPrice?: number;
  badge?: "BEST SELLER" | "HOT DEAL" | "NEW ITEM";
  image: string;
  stockMode?: StockMode; // POOL vs UNIQUE_1TO1
  credentialFormat?: CredentialFormat;
  tags?: string[];
}

export class UpdateAdminProductDto {
  title?: string;
  price?: number;
  originalPrice?: number;
  badge?: "BEST SELLER" | "HOT DEAL" | "NEW ITEM";
  stockMode?: StockMode;
  credentialFormat?: CredentialFormat;
  isActive?: boolean;
}

export class AddStockBatchDto {
  productId: string;
  productCode?: string;
  credentials: string[]; // List of raw items
  batchCode?: string; // e.g. LOT-261018-A
  supplierName?: string; // Farm or Supplier
  costPrice?: number; // Cost per item in THB
  allowRestockOverride?: boolean; // If true, re-admits existing credentialHash
}

export class UpdateStockStatusDto {
  status: StockStatus;
  defectReason?: string;
  orderNumber?: string;
}

export class UpdateRobuxStatusDto {
  status: "AVAILABLE" | "OUT_OF_STOCK";
  stockCount?: number;
  reason?: string;
}
