import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsEnum } from "class-validator";

export type StockMode = "POOL" | "UNIQUE_1TO1";
export type CredentialFormat = "USER_PASS" | "USER_PASS_2FA" | "COOKIE_TOKEN" | "REDEEM_KEY";
export type StockStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "CLAIMED_DEFECTIVE";

export class CreateAdminProductDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  categoryId: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  originalPrice?: number;

  @IsOptional()
  @IsString()
  badge?: "BEST SELLER" | "HOT DEAL" | "NEW ITEM";

  @IsString()
  image: string;

  @IsOptional()
  @IsString()
  stockMode?: StockMode;

  @IsOptional()
  @IsString()
  credentialFormat?: CredentialFormat;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateAdminProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  originalPrice?: number;

  @IsOptional()
  @IsString()
  badge?: "BEST SELLER" | "HOT DEAL" | "NEW ITEM";

  @IsOptional()
  @IsString()
  stockMode?: StockMode;

  @IsOptional()
  @IsString()
  credentialFormat?: CredentialFormat;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddStockBatchDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsArray()
  credentials: string[];

  @IsOptional()
  @IsString()
  batchCode?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsBoolean()
  allowRestockOverride?: boolean;
}

export class UpdateStockStatusDto {
  @IsString()
  status: StockStatus;

  @IsOptional()
  @IsString()
  defectReason?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;
}

export class UpdateStockItemDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  farmedMaps?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  sellingPriceText?: string;

  @IsOptional()
  @IsString()
  status?: StockStatus;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  defectReason?: string;
}

export class UpdateRobuxStatusDto {
  @IsString()
  status: "AVAILABLE" | "OUT_OF_STOCK";

  @IsOptional()
  @IsNumber()
  stockCount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
