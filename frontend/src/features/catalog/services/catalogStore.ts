import type { Category, AvailabilityStatus } from "@/types";
import type { GraphiteProduct } from "@/features/admin/components/graphite-amber/ProductsDView";
import { mockCategories } from "@/mocks/catalog";
import {
  fetchAdminCategories,
  createAdminCategory as apiCreateCategory,
  updateAdminCategory as apiUpdateCategory,
  deleteAdminCategory as apiDeleteCategory,
  fetchAdminProducts,
  createAdminProduct as apiCreateProduct,
  updateAdminProduct as apiUpdateProduct,
  deleteAdminProduct as apiDeleteProduct,
} from "@/features/admin/services/admin-api";

const STORAGE_KEY_CATEGORIES = "kaitan_admin_categories_cache";
const STORAGE_KEY_PRODUCTS = "kaitan_admin_products_cache";
const CATALOG_EVENT = "kaitan_catalog_change";

export const initialAdminProducts: GraphiteProduct[] = [
  {
    id: "prod_bse_01",
    code: "BSE-PICKAXE-MAX",
    title: "ไก่ตัน ที่ขุดตัน",
    category: "Map Break and Steal Egg",
    price: 299,
    stock: 2,
    status: "AVAILABLE",
    sold: 0,
  },
];

function notifyCatalogChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CATALOG_EVENT));
  }
}

// ---------------- LOCAL STORAGE HELPERS ----------------

function getLocalCategories(): Category[] {
  if (typeof window === "undefined") return mockCategories;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (!raw) return mockCategories;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : mockCategories;
  } catch {
    return mockCategories;
  }
}

function setLocalCategories(cats: Category[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
  } catch {}
}

function getLocalProducts(): GraphiteProduct[] {
  if (typeof window === "undefined") return initialAdminProducts;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (!raw) return initialAdminProducts;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialAdminProducts;
  } catch {
    return initialAdminProducts;
  }
}

function setLocalProducts(prods: GraphiteProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(prods));
  } catch {}
}

// ---------------- CATEGORIES OPERATIONS ----------------

export async function getAdminCategories(): Promise<Category[]> {
  if (typeof window === "undefined") return mockCategories;
  try {
    const apiData = await fetchAdminCategories();
    if (apiData && Array.isArray(apiData)) {
      const mapped: Category[] = apiData.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
        image: c.image || "/assets/blox_fruits_category.jpg",
        itemCount: c.itemCount ?? 0,
        priceMin: c.priceMin ?? 0,
        priceMax: c.priceMax ?? 0,
        accent: "amber",
        status: c.status,
        isOutOfStock: c.status === "OUT_OF_STOCK",
      }));
      setLocalCategories(mapped);
      return mapped;
    }
  } catch (err) {
    // API failed or offline: fall back to local cache
  }

  // Fallback: calculate itemCount from stored products
  const cached = getLocalCategories();
  const products = getLocalProducts();

  return cached.map((cat) => {
    const matchingProducts = products.filter(
      (p) => p.category === cat.name || p.category === cat.id
    );
    const count = matchingProducts.length;
    const prices = matchingProducts.map((p) => p.price);
    const priceMin = prices.length > 0 ? Math.min(...prices) : cat.priceMin;
    const priceMax = prices.length > 0 ? Math.max(...prices) : cat.priceMax;

    return {
      ...cat,
      itemCount: count,
      priceMin: count > 0 ? priceMin : 0,
      priceMax: count > 0 ? priceMax : 0,
    };
  });
}

export async function saveAdminCategory(category: Category): Promise<Category> {
  const current = getLocalCategories();
  const exists = current.some((c) => c.id === category.id);

  let savedCategory = category;

  try {
    if (exists) {
      const res = await apiUpdateCategory(category.id, {
        name: category.name,
        slug: category.id,
        description: category.description,
        image: category.image,
        isActive: category.status === "AVAILABLE",
      });
      savedCategory = {
        ...category,
        name: res.name,
        description: res.description,
        image: res.image,
        status: res.status,
      };
    } else {
      const res = await apiCreateCategory({
        name: category.name,
        slug: category.id,
        description: category.description,
        image: category.image,
        isActive: category.status === "AVAILABLE",
      });
      savedCategory = {
        ...category,
        id: res.id,
        name: res.name,
        description: res.description,
        image: res.image,
        status: res.status,
      };
    }
  } catch (err) {
    // API failed: save locally
  }

  let updatedList: Category[];
  if (exists) {
    updatedList = current.map((c) => (c.id === category.id ? savedCategory : c));
  } else {
    updatedList = [savedCategory, ...current];
  }

  setLocalCategories(updatedList);
  notifyCatalogChange();
  return savedCategory;
}

export async function toggleAdminCategoryStatus(cat: Category): Promise<Category> {
  const nextStatus: AvailabilityStatus =
    cat.status === "AVAILABLE" ? "OUT_OF_STOCK" : "AVAILABLE";
  const updated: Category = {
    ...cat,
    status: nextStatus,
    isOutOfStock: nextStatus === "OUT_OF_STOCK",
  };

  try {
    await apiUpdateCategory(cat.id, { isActive: nextStatus === "AVAILABLE" });
  } catch {}

  const current = getLocalCategories();
  const nextList = current.map((c) => (c.id === cat.id ? updated : c));
  setLocalCategories(nextList);
  notifyCatalogChange();
  return updated;
}

export async function deleteAdminCategory(categoryId: string): Promise<void> {
  try {
    await apiDeleteCategory(categoryId);
  } catch {}

  const current = getLocalCategories();
  const nextList = current.filter((c) => c.id !== categoryId);
  setLocalCategories(nextList);
  notifyCatalogChange();
}

// ---------------- PRODUCTS OPERATIONS ----------------

export async function getAdminProducts(): Promise<GraphiteProduct[]> {
  if (typeof window === "undefined") return initialAdminProducts;
  try {
    const apiData = await fetchAdminProducts();
    if (apiData && Array.isArray(apiData)) {
      const mapped: GraphiteProduct[] = apiData.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        category: p.category,
        price: p.price,
        stock: p.stock,
        status: p.status,
        sold: p.sold,
      }));
      setLocalProducts(mapped);
      return mapped;
    }
  } catch (err) {
    // API failed: fallback to cache
  }

  return getLocalProducts();
}

export async function saveAdminProduct(
  product: GraphiteProduct,
  stockCredentials?: string[]
): Promise<GraphiteProduct> {
  const current = getLocalProducts();
  const exists = current.some((p) => p.id === product.id);

  let savedProduct = product;

  try {
    if (exists) {
      const res = await apiUpdateProduct(product.id, {
        code: product.code,
        title: product.title,
        categoryId: product.category,
        price: product.price,
        status: product.status,
        stock: product.stock,
        credentials: stockCredentials,
      });
      savedProduct = {
        id: res.id,
        code: res.code,
        title: res.title,
        category: res.category,
        price: res.price,
        stock: res.stock,
        status: res.status,
        sold: res.sold,
      };
    } else {
      const res = await apiCreateProduct({
        code: product.code,
        title: product.title,
        categoryId: product.category,
        price: product.price,
        credentials: stockCredentials,
      });
      savedProduct = {
        id: res.id,
        code: res.code,
        title: res.title,
        category: res.category,
        price: res.price,
        stock: res.stock,
        status: res.status,
        sold: res.sold,
      };
    }
  } catch (err) {
    // fallback to local
  }

  let nextList: GraphiteProduct[];
  if (exists) {
    nextList = current.map((p) => (p.id === product.id ? savedProduct : p));
  } else {
    nextList = [savedProduct, ...current];
  }

  setLocalProducts(nextList);
  notifyCatalogChange();
  return savedProduct;
}

export async function toggleAdminProductStatus(
  productId: string,
  newStatus: "AVAILABLE" | "OUT_OF_STOCK",
  newStock: number
): Promise<void> {
  try {
    await apiUpdateProduct(productId, {
      status: newStatus,
      stock: newStock,
      isActive: newStatus === "AVAILABLE",
    });
  } catch {}

  const current = getLocalProducts();
  const nextList = current.map((p) =>
    p.id === productId ? { ...p, status: newStatus, stock: newStock } : p
  );
  setLocalProducts(nextList);
  notifyCatalogChange();
}

export async function deleteAdminProduct(productId: string): Promise<void> {
  try {
    await apiDeleteProduct(productId);
  } catch {}

  const current = getLocalProducts();
  const nextList = current.filter((p) => p.id !== productId && p.code !== productId);
  setLocalProducts(nextList);
  notifyCatalogChange();
}

export function subscribeToCatalogChanges(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CATALOG_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CATALOG_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
