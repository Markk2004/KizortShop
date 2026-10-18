import type { RecentOrder, Review, StoreStat } from "@/types";

export const mockRecentOrders: RecentOrder[] = [
  { id: "o1", username: "Sal***", productName: "ไก่ตัน Anime Dice MAX", amount: 52.25, minutesAgo: 3 },
  { id: "o2", username: "Plu***", productName: "ผลโมจิตื่น V2 คาตานะคู่", amount: 120, minutesAgo: 12 },
  { id: "o3", username: "Jay***", productName: "สุ่มไอดีการันตีผลตื่น", amount: 35, minutesAgo: 25 },
  { id: "o4", username: "Gun***", productName: "ไก่ตัน หมัดก็อดฮิวแมน + ดาบคู่", amount: 89, minutesAgo: 41 },
];

export const mockStats: StoreStat[] = [
  { id: "users", label: "สมาชิกลงทะเบียน", value: "128,490", note: "+12.4% ในเดือนนี้", noteTone: "positive" },
  { id: "categories", label: "หมวดหมู่สินค้า", value: "154", note: "ครอบคลุมทุกเซิร์ฟเวอร์" },
  { id: "stock", label: "สต็อกพร้อมจัดส่ง", value: "3,420", note: "ระบบจัดส่งอัตโนมัติ", noteTone: "positive" },
  { id: "orders", label: "คำสั่งซื้อสำเร็จ", value: "89,200+", note: "การันตีความปลอดภัย 100%" },
];

export const mockReviews: Review[] = [
  { id: "r1", username: "Sal***", productName: "Anime Dice MAX", rating: 5, comment: "ระบบส่งไวมากครับ ได้ของครบตามที่เขียนไว้ในรายละเอียด การันตีความปลอดภัย" },
  { id: "r2", username: "Plu***", productName: "โมจิ V2 ตื่นครบ", rating: 5, comment: "สแกนเติมเงินผ่าน QR ไวมาก หักเงินแล้วของเด้งในหน้าประวัติทันที บริการประทับใจ" },
  { id: "r3", username: "Jay***", productName: "ตัว 1 in 880 บัพตัน", rating: 5, comment: "เข้าเล่นได้ปกติทุกไอดี สะอาด ปลอดภัย ไม่มีดึงกลับอย่างแน่นอน แนะนำร้านนี้ครับ" },
];
