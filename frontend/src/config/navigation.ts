import {
  Boxes,
  Clock3,
  House,
  Package,
  ShieldCheck,
  ShoppingBag,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const sidebarNav: SidebarNavItem[] = [
  { label: "หน้าแรก", href: "/", icon: House },
  { label: "สินค้าทั้งหมด", href: "/products", icon: ShoppingBag },
  { label: "เติมเครดิต", href: "/topup", icon: WalletCards },
  { label: "ประวัติรายการ", href: "/orders", icon: Clock3 },
  { label: "แจ้งปัญหาเคลม", href: "/support", icon: ShieldCheck },
];

/** Store management menu for staff and admins */
export const adminSidebarQuickNav: SidebarNavItem[] = [
  { label: "คลังสต็อกรหัสเกม", href: "/admin/stocks", icon: Boxes },
  { label: "จัดการผู้ใช้งานร้าน", href: "/admin/users", icon: Users },
  { label: "จัดการสินค้า/บริการ", href: "/admin/products", icon: Package },
];

export interface AnchorItem {
  id: string;
  label: string;
}

/** In-page anchor island on the home page. Order must match section order. */
export const homeAnchors: AnchorItem[] = [
  { id: "section-hero", label: "ไฮไลต์" },
  { id: "section-quick", label: "บริการ" },
  { id: "section-stats", label: "สถิติ" },
  { id: "section-categories", label: "หมวดเกม" },
  { id: "section-vip", label: "ประกาศ" },
  { id: "section-products", label: "สินค้าแนะนำ" },
  { id: "section-reviews", label: "รีวิว" },
];
