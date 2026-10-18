import type { AvailabilityCheckResult, AvailabilityStatus, Product } from "@/types";

export interface RobuxServiceConfig {
  serviceId: string;
  serviceName: string;
  status: AvailabilityStatus;
  stockCount: number;
  ratePerHundredBaht: number;
  reason?: string;
  lastUpdatedAt: string;
}

const STORAGE_KEY_ROBUX_CONFIG = "kaitan_robux_service_config";
const STORAGE_KEY_PRODUCT_STATUS = "kaitan_product_status_overrides";
const INVENTORY_EVENT = "kaitan_inventory_status_change";

// Default configuration: Disabled / Temporarily out of stock as requested
const defaultRobuxConfig: RobuxServiceConfig = {
  serviceId: "robux-auto-topup",
  serviceName: "เติม Robux อัตโนมัติ 24 ชม.",
  status: "OUT_OF_STOCK",
  stockCount: 0,
  ratePerHundredBaht: 1000,
  reason: "ระบบปรับปรุงชั่วคราว อยู่ระหว่างการเติมสต็อก Robux ใหม่",
  lastUpdatedAt: new Date().toISOString(),
};

/**
 * Helper to safely read from localStorage in browser environment
 */
export function getRobuxServiceConfig(): RobuxServiceConfig {
  if (typeof window === "undefined") {
    return defaultRobuxConfig;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROBUX_CONFIG);
    if (!raw) return defaultRobuxConfig;
    return JSON.parse(raw) as RobuxServiceConfig;
  } catch {
    return defaultRobuxConfig;
  }
}

/**
 * Core check function for Robux auto-topup availability
 */
export function checkRobuxAvailability(): AvailabilityCheckResult {
  const config = getRobuxServiceConfig();
  const isAvailable = config.status === "AVAILABLE" && config.stockCount > 0;

  return {
    serviceId: config.serviceId,
    serviceName: config.serviceName,
    isAvailable,
    status: config.status,
    statusLabel: isAvailable ? "มีสินค้า" : "สินค้าหมดชั่วคราว",
    stockCount: config.stockCount,
    message: isAvailable
      ? "บริการเติม Robux อัตโนมัติเปิดให้บริการตามปกติ ส่งมอบทันที 24 ชม."
      : config.reason || "สินค้าหมดชั่วคราว ระบบปิดการเติม Robux อัตโนมัติชั่วคราว",
    checkedAt: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
  };
}

/**
 * Admin function: Update Robux auto-topup availability status
 */
export function setRobuxServiceConfig(updates: Partial<RobuxServiceConfig>): RobuxServiceConfig {
  const current = getRobuxServiceConfig();
  const updated: RobuxServiceConfig = {
    ...current,
    ...updates,
    lastUpdatedAt: new Date().toISOString(),
  };

  // If status changed to OUT_OF_STOCK, force stockCount to 0 if not provided
  if (updates.status === "OUT_OF_STOCK" && updates.stockCount === undefined) {
    updated.stockCount = 0;
  } else if (updates.status === "AVAILABLE" && updated.stockCount === 0) {
    updated.stockCount = 10000; // default available stock
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_ROBUX_CONFIG, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(INVENTORY_EVENT, { detail: updated }));
    } catch {
      // storage error fallback
    }
  }

  return updated;
}

/**
 * General check function for any product
 */
export function checkProductAvailability(product: Pick<Product, "id" | "title" | "stock" | "status">): AvailabilityCheckResult {
  const overrides = getProductStatusOverrides();
  const override = overrides[product.id];

  const effectiveStatus: AvailabilityStatus = override?.status || product.status || (product.stock > 0 ? "AVAILABLE" : "OUT_OF_STOCK");
  const effectiveStock = override?.stock !== undefined ? override.stock : product.stock;
  const isAvailable = effectiveStatus === "AVAILABLE" && effectiveStock > 0;

  return {
    serviceId: product.id,
    serviceName: product.title,
    isAvailable,
    status: effectiveStatus,
    statusLabel: isAvailable ? "มีสินค้า" : "สินค้าหมดชั่วคราว",
    stockCount: effectiveStock,
    message: isAvailable
      ? "สินค้าพร้อมจำหน่ายและจัดส่งอัตโนมัติ"
      : "สินค้าหมดชั่วคราว กำลังรอการเติมสต็อก",
    checkedAt: new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
  };
}

/**
 * Helper for product status overrides in admin
 */
export function getProductStatusOverrides(): Record<string, { status: AvailabilityStatus; stock: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCT_STATUS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Admin function: Update individual product availability status
 */
export function setProductAvailability(
  productId: string,
  status: AvailabilityStatus,
  stock?: number,
): void {
  if (typeof window === "undefined") return;
  const overrides = getProductStatusOverrides();
  overrides[productId] = {
    status,
    stock: stock !== undefined ? stock : (status === "AVAILABLE" ? 10 : 0),
  };

  try {
    localStorage.setItem(STORAGE_KEY_PRODUCT_STATUS, JSON.stringify(overrides));
    window.dispatchEvent(new CustomEvent(INVENTORY_EVENT, { detail: overrides }));
  } catch {
    // fallback
  }
}

/**
 * Event listener for real-time inventory updates across components
 */
export function subscribeToInventoryChanges(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback();
  window.addEventListener(INVENTORY_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(INVENTORY_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
