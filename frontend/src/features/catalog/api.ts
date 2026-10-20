import { USE_MOCKS, apiGet } from "@/lib/api-client";
import { mockCategories, mockProducts } from "@/mocks/catalog";
import type { Category, Product } from "@/types";
import { getProductStatusOverrides, getRobuxServiceConfig } from "./services/inventoryCheck";
import { getAdminCategories } from "./services/catalogStore";
import { fetchAdminProducts } from "@/features/admin/services/admin-api";

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
  if (typeof window === "undefined") {
    return applyDynamicAvailability(mockCategories);
  }
  try {
    const list = await getAdminCategories();
    if (list && list.length > 0) {
      return applyDynamicAvailability(list);
    }
  } catch {}
  return applyDynamicAvailability(mockCategories);
}

async function fetchRealStorefrontProducts(): Promise<Product[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const apiData = await fetchAdminProducts();
    if (apiData && Array.isArray(apiData)) {
      const visible = apiData.filter((p) => p.code !== "KAITUN-VAULT-POOL");
      return visible.map((p) => ({
        id: p.id,
        code: p.code,
        categoryId: p.categoryId || p.categorySlug || p.category,
        title: p.title,
        subtitle: p.description || p.category,
        image: p.image || "/assets/blox_fruits_category.jpg",
        tags: [p.category, `SKU: ${p.code}`],
        price: p.price,
        originalPrice: p.originalPrice,
        stock: p.stock,
        badge: (p.badge as any) || undefined,
        status: p.status,
      }));
    }
  } catch {}
  return null;
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const real = await fetchRealStorefrontProducts();
  if (real && real.length > 0) {
    return applyProductAvailability(real);
  }
  if (USE_MOCKS) return applyProductAvailability(mockProducts);
  const data = await apiGet<Product[]>("/products?featured=true");
  return applyProductAvailability(data);
}

export async function getProducts(categoryId?: string): Promise<Product[]> {
  const real = await fetchRealStorefrontProducts();
  if (real && real.length > 0) {
    const filtered = categoryId
      ? real.filter(
          (p) =>
            p.categoryId === categoryId ||
            p.tags?.some((t) => t.toLowerCase() === categoryId.toLowerCase()),
        )
      : real;
    return applyProductAvailability(filtered);
  }
  if (USE_MOCKS) {
    const list = categoryId ? mockProducts.filter((p) => p.categoryId === categoryId) : mockProducts;
    return applyProductAvailability(list);
  }
  const data = await apiGet<Product[]>(`/products${categoryId ? `?category=${categoryId}` : ""}`);
  return applyProductAvailability(data);
}
