export class CreateAdminProductDto {
  code: string;
  title: string;
  description?: string;
  categoryId: string;
  price: number;
  originalPrice?: number;
  badge?: "BEST SELLER" | "HOT DEAL" | "NEW ITEM";
  image: string;
  tags?: string[];
}

export class UpdateAdminProductDto {
  title?: string;
  price?: number;
  originalPrice?: number;
  badge?: "BEST SELLER" | "HOT DEAL" | "NEW ITEM";
  isActive?: boolean;
}

export class AddStockBatchDto {
  productId: string;
  credentials: string[]; // List of "USER:PASS" or "KEY" lines
}

export class UpdateRobuxStatusDto {
  status: "AVAILABLE" | "OUT_OF_STOCK";
  stockCount?: number;
  reason?: string;
}
