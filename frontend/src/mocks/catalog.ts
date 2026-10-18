import type { Category, Product } from "@/types";

const IMG = "https://lh3.googleusercontent.com/aida-public/";

export const mockCategories: Category[] = [
  { id: "blox-fruits", name: "ไก่ตัน Blox Fruits ขั้นเทพ", description: "หมัดก็อดฮิวแมน ดาบคู่ และผลตื่น", image: "/assets/blox_fruits_category.jpg", itemCount: 18, priceMin: 25, priceMax: 99, accent: "blue", status: "AVAILABLE" },
  { id: "anime-dice", name: "Anime Dice / สุ่มเต๋า", description: "Trait เทพ การันตีผลแรร์พร้อมเล่น", image: "/assets/anime_dice_category.jpg", itemCount: 14, priceMin: 15, priceMax: 52, accent: "sky", status: "AVAILABLE" },
  { id: "anime-defenders", name: "Anime Defenders / Vanguards", description: "ยูนิตลับ สแตทแน่น พร้อมลงเรด", image: "/assets/anime_defenders_category.jpg", itemCount: 26, priceMin: 20, priceMax: 50, accent: "indigo", status: "AVAILABLE" },
  { id: "robux", name: "เติม Robux อัตโนมัติ", description: "เรทสูง ระบบเข้ากลุ่มส่งตรง 24 ชม. (สินค้าหมดชั่วคราว)", image: "/assets/robux_topup_category.jpg", itemCount: 0, priceMin: 10, priceMax: 55, hot: false, accent: "amber", status: "OUT_OF_STOCK", isOutOfStock: true },
];

export const mockProducts: Product[] = [
  {
    id: "p-8821", code: "#8821", categoryId: "blox-fruits",
    title: "ไก่ตัน Blox Fruits หมัด Godhuman + สมอ Shark Anchor",
    image: `${IMG}AB6AXuBJzAsjVeV544ubwxzOb5v8fLBw1ExEUk89cDSV5ItF59zICuhAbsGJW5kcLS2v3mJvwZFmlwo1dFdGaAOzuKiNbqEXE48GbA6v_8wf5YuLNeegfGvkcA5UkCAWIBadBZP_K1X0coHkrrzkqD56OVwfclVNVZBXzINXHk52rq1sYEavVolKguWe1o89khD-IyJ7NCnNzJqSVgriVT_Qytr6-UMFQ-5iFw_phqzm3n7X1U07XWfiesfb`,
    tags: ["Lv.2550", "ดาบคู่ครบ", "โมจิตื่น"], price: 99, originalPrice: 120, stock: 27, badge: "BEST SELLER", discountPercent: 15, status: "AVAILABLE",
  },
  {
    id: "p-8822", code: "#8822", categoryId: "blox-fruits",
    title: "ไก่ตันผลเสือขาว Kitsune ตื่นครบสกิล พร้อมหมัด 6 สไตล์",
    image: `${IMG}AB6AXuDvo_zrrROiNHzC6ieUDenezABxt3i2ybh8Bbcxhl71Yy3md10FEmQOC9IPHbbrXeUizOHunqD5EJgesBMgT_MfXWrLy9OHbPeqcTSMd14zCcnDaxPruwau9om8w4fg_o4GqBtB292CVm5FiN0mRTvmXgm62f9co7nSJ_AL1vRnbBIqyML3yyywdv6bDEmPoqB_j9MzHv5jmTESxTn56Fl_A3ELBXSJM71PXRQQoMSOUcEp_iKsiNjk`,
    tags: ["ผลเสือฟูลตื่น", "เผ่า V4 สมบูรณ์"], price: 55, originalPrice: 75, stock: 12, badge: "HOT DEAL", discountPercent: 10, status: "AVAILABLE",
  },
  {
    id: "p-8823", code: "#8823", categoryId: "blox-fruits",
    title: "ไอดีสุ่มไก่ตัน 6 หมัด เลเวลตัน 2550 การันตีดาบโซโล",
    image: `${IMG}AB6AXuBNGqd11dPdrKN3oqvOPUxWb3Ywe4WPoKADAeVAHvPpzBvOar4Ced_tVTmRSUgXfACoQdVVdqM8Bl2ESNZAxS-FwFtAXgtdJLhyIzlVggyF2RdZUAO1vXQq3j1Lq75Z2ojz-iN0MkT_daqIBJ3qbo8B-rTndao5RDH796pmzaSNedB7Jo70cqZBI-7EmEcjK1RzMFRWU6pFqhrnUIfMidNB1eXgfAxB_4PuiyL4kff4GOcCg3gvr59b`,
    tags: ["การันตี 100%", "เบลี 50M+"], price: 39, originalPrice: 49, stock: 5, badge: "NEW ITEM", status: "AVAILABLE",
  },
  {
    id: "p-8824", code: "#8824", categoryId: "blox-fruits",
    title: "ไก่ตันผลโมจิคู่ดาบยมแท้ + เผ่ามิ้งค์ V4 ปีกม่วง",
    image: `${IMG}AB6AXuBLxnK4dL1SFJCMqzPu5drFrJ3Zmn7Tggn8JZGQEr7ZM7amkUI-ymv0HlzbuoDto1-R0izY4lAYjHiK9BHWenJcYxCDpz6FXKsXMwNt-vwltaCKrSt20Djunnempl7z6CX3cqfB--Lzlav_WZpqAP5xyWwb0jn3mp5FDVNBFpo5iVNkIXtdWdPiKJRqzxKGaUOnYEVtrgZzZzPqmWTo-y5Wl7MDryYHrTfrkW9JsGgY1_CULdk2lLYF`,
    tags: ["ดาบยมแท้ Cursed", "เสร็จสิ้นเควส"], price: 150, stock: 0, status: "OUT_OF_STOCK",
  },
  {
    id: "p-rbx-500", code: "#RBX-500", categoryId: "robux",
    title: "เติม Robux 500 R$ ระบบกลุ่มอัตโนมัติ ส่งเข้า ID ทันที",
    image: "/assets/robux_topup_category.jpg",
    tags: ["ระบบกลุ่มออโต้", "เข้าทันที 24 ชม."], price: 95, originalPrice: 110, stock: 0, status: "OUT_OF_STOCK",
  },
  {
    id: "p-rbx-1000", code: "#RBX-1000", categoryId: "robux",
    title: "เติม Robux 1,000 R$ เรทพิเศษ คุ้มครองความปลอดภัย 100%",
    image: "/assets/robux_topup_category.jpg",
    tags: ["เรทพิเศษ VIP", "ส่งมอบ 0.8 วิ"], price: 185, originalPrice: 220, stock: 0, status: "OUT_OF_STOCK",
  },
];
