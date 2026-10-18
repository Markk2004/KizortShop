import { USE_MOCKS, apiGet } from "@/lib/api-client";
import { mockCategories, mockProducts } from "@/mocks/catalog";
import type { Category, Product } from "@/types";
import { getProductStatusOverrides, getRobuxServiceConfig } from "./services/inventoryCheck";

// Swap mocks for real endpoints by setting NEXT_PUBLIC_USE_MOCKS=false.
// Backend contract: see backend/src/modules/{categories,products}/README.md

function applyDynamicAvailability(categories: Category[]): Category[] {
  if (typeof window === "undefined") return categories;
  const robuxCfg = getRobuxServiceConfig();

  return categories.map((cat) => {
    if (cat.id === "robux") {
      const isAvailable = robuxCfg.status === "AVAILABLE" && robuxCfg.stockCount > 0;
      return {
        ...cat,
        status: robuxCfg.status,
        isOutOfStock: !isAvailable,
        itemCount: isAvailable ? 6 : 0,
        description: isAvailable
          ? "เรทสูง ระบบเข้ากลุ่มส่งตรง 24 ชม."
          : "เรทสูง ระบบเข้ากลุ่มส่งตรง 24 ชม. (สินค้าหมดชั่วคราว)",
      };
    }
    return cat;
  });
}

function applyProductAvailability(products: Product[]): Product[] {
  if (typeof window === "undefined") return products;
  const robuxCfg = getRobuxServiceConfig();
  const overrides = getProductStatusOverrides();

  return products.map((prod) => {
    if (prod.categoryId === "robux") {
      const isAvailable = robuxCfg.status === "AVAILABLE" && robuxCfg.stockCount > 0;
      return {
        ...prod,
        status: robuxCfg.status,
        stock: isAvailable ? 50 : 0,
      };
    }

    const ov = overrides[prod.id];
    if (ov) {
      return {
        ...prod,
        status: ov.status,
        stock: ov.stock,
      };
    }
    return prod;
  });
}

export async function getCategories(): Promise<Category[]> {
  if (USE_MOCKS) return applyDynamicAvailability(mockCategories);
  const data = await apiGet<Category[]>("/categories");
  return applyDynamicAvailability(data);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  if (USE_MOCKS) return applyProductAvailability(mockProducts);
  const data = await apiGet<Product[]>("/products?featured=true");
  return applyProductAvailability(data);
}

export async function getProducts(categoryId?: string): Promise<Product[]> {
  if (USE_MOCKS) {
    const list = categoryId ? mockProducts.filter((p) => p.categoryId === categoryId) : mockProducts;
    return applyProductAvailability(list);
  }
  const data = await apiGet<Product[]>(`/products${categoryId ? `?category=${categoryId}` : ""}`);
  return applyProductAvailability(data);
}
