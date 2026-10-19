# KizortShop (KAITAN STORE) — Development Guidelines & Critical Contexts

> [!IMPORTANT]
> **เอกสารคู่มือกฎเหล็กและข้อกำหนดสำคัญในการพัฒนาโค้ด (Mandatory Context & Dev Standards)**
> เมื่อมีการเขียน พัฒนา หรือเพิ่มฟังก์ชัน/หน้าจอใหม่เข้ามาในโปรเจกต์ KizortShop **ต้องปฏิบัติตามข้อกำหนดในเอกสารนี้อย่างเคร่งครัด**

---

## 1. กฎเหล็กการแจ้งเตือนส่วนกลาง (Central Toast Notification Standard)

ระบบมีระบบแจ้งเตือนส่วนกลางตัวเดียวที่ติดตั้งอยู่ที่ระดับบนสุดของแอปพลิเคชัน ([`RootLayout`](file:///e:/ouroboros-study/kaitan-store/frontend/src/app/layout.tsx)) ผ่าน [`ToastProvider`](file:///e:/ouroboros-study/kaitan-store/frontend/src/common/components/ToastProvider.tsx):

> [!CRITICAL]
> **เมื่อเขียนฟังก์ชันหรือหน้าจอใหม่ที่มีการกระทำ (User/Admin Action) เช่น:**
> 1. บันทึกข้อมูลสำเร็จ (Create / Update / Save)
> 2. ลบข้อมูลหรือยกเลิกรายการ (Delete / Cancel)
> 3. เปลี่ยนแปลงสถานะ (Toggle Status, Publish / Hide, Refund, Replace)
> 4. เกิดข้อผิดพลาดในการตรวจสอบข้อมูลหรือเชื่อมต่อ API (Validation Error, Network Error)
> 
> **ห้ามสร้างกล่อง Alert หรือ State แจ้งเตือนขึ้นมาใช้เองแยกต่างหากเด็ดขาด** ให้ดึง Hook `useToast()` มาเรียกใช้งานเสมอ เพื่อให้หน้าตาการแจ้งเตือน (UI Alert) ลอยขึ้นที่ **มุมขวาล่าง (Bottom-Right)** อย่างเป็นระเบียบและเป็นมาตรฐานเดียวกันทั้งระบบ

### วิธีการเรียกใช้งาน `useToast()`:
```tsx
import { useToast } from "@/common/components/ToastProvider";

export function AnyComponent() {
  const { success, warning, error, info, toast } = useToast();

  const handleAction = async () => {
    try {
      // 1. แจ้งเตือนเมื่อทำรายการสำเร็จ
      success("บันทึกสำเร็จ", "ข้อมูลถูกอัปเดตเข้าสู่ระบบเรียบร้อยแล้ว");
      
      // 2. แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะหรือเตือนระวัง
      warning("ซ่อนรายการแล้ว", "รายการนี้จะไม่แสดงผลบนหน้าร้าน");

      // 3. แจ้งเตือนสถานะทั่วไป
      info("อัปเดตข้อมูล", "ระบบกำลังประมวลผลคำสั่งซื้อ");
    } catch (err: any) {
      // 4. แจ้งเตือนข้อผิดพลาด
      error("เกิดข้อผิดพลาด", err?.message || "ไม่สามารถทำรายการได้ในขณะนี้");
    }
  };

  return <button onClick={handleAction}>ดำเนินการ</button>;
}
```

---

## 2. กฎการยืนยันคำสั่งสำคัญ 2 ขั้นตอน (2-Step Hard Confirmation)

> [!WARNING]
> สำหรับคำสั่งที่ก่อให้เกิดผลกระทบรุนแรง (Destructive / Critical Financial & Stock Actions) เช่น:
> - การลบสินค้า, ลบหมวดหมู่, ลบแบนเนอร์
> - การคืนเงินเคลม (Refund) เข้ากระเป๋าเงินลูกค้า
> - การเปลี่ยนไอดีเคลมใหม่ (Claim Replacement)
> - การปิดการวางจำหน่ายสินค้าที่มีสต็อกอยู่ (Disable Product)
> - การกดยกเลิกแบบฟอร์มที่มีข้อมูลกรอกค้างไว้ (Discard Dirty Form)
>
> **ต้องเรียกใช้งาน [`HardConfirmModal`](file:///e:/ouroboros-study/kaitan-store/frontend/src/features/admin/components/HardConfirmModal.tsx) เสมอ** โดยบังคับให้แอดมิน:
> 1. ติ๊ก Checkbox รับทราบผลกระทบ
> 2. พิมพ์คีย์เวิร์ดยืนยันตัวพิมพ์ใหญ่ (เช่น `DELETE`, `DISABLE`, `REFUND`, `DISCARD`) ก่อนที่ปุ่มยืนยันจะปลดล็อก

---

## 3. กฎการออกแบบ UI และขนาดตัวอักษร (Design System & Typography)

1. **สไตล์หลักระบบหลังบ้าน**:
   - ธีม: **Dark Carbon & Amber Accent** (พื้นหลัง `#09090b` ถึง `#141210`, การ์ด `#18181b` / `#1f1c19`, เส้นขอบ `border-zinc-800` หรือ `#332e29`)
   - สีอำพัน (`Amber` / `#f59e0b`): ใช้กับจุดที่กดได้ (Interactive Buttons), ป้ายรหัส SKU/ID, และตำแหน่งที่กำลังเปิดใช้งาน (Active/Focus) เท่านั้น
   - สีเขียว (`Emerald` / `#22c55e`): บอกสถานะพร้อมใช้งาน / มีสินค้า / ดำเนินการสำเร็จ
   - สีแดง (`Red` / `#ef4444`): บอกสถานะสินค้าหมด / ข้อผิดพลาด / สต็อก 0 / เครื่องหมายจำเป็น `*`
2. **ขนาดตัวอักษรและจุดกด**:
   - ห้ามใช้ตัวหนังสือเล็กเกินไป (เนื้อหาตารางและปุ่มต้องไม่ต่ำกว่า `13.5px–14px`)
   - ทุกปุ่มกด (Touch Targets) ต้องมีความสูงอย่างน้อย `40px` ถึง `48px` เสมอ
3. **ข้อห้ามเรื่อง EMOJI**:
   - **ห้ามใส่ Emoji ในโค้ด, UI, Label, Badge หรือเอกสารใดๆ เด็ดขาด** ให้ใช้ไอคอน Vector จากไลบรารี `lucide-react` แทน

---

## 4. แถบค้นหาและตัวกรองอัจฉริยะ (Smart Filter Bar)

ในทุกหน้าตารางข้อมูลของระบบหลังบ้าน ต้องติดตั้ง [`AdminSmartFilterBar`](file:///e:/ouroboros-study/kaitan-store/frontend/src/features/admin/components/AdminSmartFilterBar.tsx) ที่มีฟังก์ชัน `verifySearchInput`:
- ตรวจสอบความถูกต้องของพยัญชนะไทย สระ วรรณยุกต์ อักษรอังกฤษ ตัวเลข และบล็อกอักขระที่ไม่ปลอดภัย (`< > ; ' " \`)
- มีปุ่ม Filter Pills แสดงจำนวนสด เช่น `ทั้งหมด · N / มีสินค้า · N / หมดชั่วคราว · N`

---

## 5. รายการโครงสร้างเส้นทางระบบหลังบ้าน (Admin Route Standards)

- `/admin/dashboard`: แดชบอร์ดสรุปภาพรวมยอดขายและคำสั่งซื้อ
- `/admin/products`: จัดการสินค้า (SKU) และคลังไอดี
- `/admin/categories`: จัดการหมวดหมู่เกมและภาพปก 16:9
- `/admin/banners`: จัดการแบนเนอร์ Hero Carousel และข้อความประกาศหน้าร้าน
- `/admin/stocks`: คลังสต็อกรหัสเกมเข้ารหัส AES-256 Vault
- `/admin/orders`: คำสั่งซื้อทั้งหมดพร้อม Slide-Over Drawer
- `/admin/topups`: ตรวจสอบประวัติการเติมเงินและสลิป PromptPay
- `/admin/users`: จัดการสมาชิก ยอดเงินกระเป๋า และบทบาทแอดมิน
