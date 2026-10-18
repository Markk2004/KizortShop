# KAITAN STORE — Monorepo Architecture

โปรเจกต์ร้านค้าไอดีเกมและบริการ Roblox อัตโนมัติ 24 ชม. สไตล์ **Refined Luxury Dark** แยกส่วน `frontend/` และ `backend/` อย่างชัดเจนเพื่อให้พัฒนาและเพิ่มฟีเจอร์ได้อิสระ

---

## 1. ภาพรวมโครงสร้างโปรเจกต์ (Workspace Layout)

```text
kaitan-store/
├── package.json                     # npm workspaces root
├── README.md                        # คู่มือสถาปัตยกรรมและการจัดโฟลเดอร์
├── packages/
│   └── shared/                      # Type & DTO ที่ใช้ร่วมกันระหว่าง Frontend และ Backend
│       ├── package.json
│       └── src/index.ts
├── frontend/                        # Next.js (App Router) + TypeScript + Tailwind CSS
│   ├── public/assets/               # รูปภาพหมวดหมู่เกมและกราฟิกประจำร้าน
│   └── src/
│       ├── app/                     # ชั้น Routing เท่านั้น (ไม่ใส่ Business Logic)
│       │   ├── layout.tsx           # โหลดฟอนต์ Prompt + Plus Jakarta Sans
│       │   └── (store)/             # Route Group ที่ใช้โครงสร้าง AppShell ร่วมกัน
│       │       ├── layout.tsx
│       │       ├── page.tsx         # หน้าแรก (Landing Page)
│       │       ├── products/page.tsx
│       │       ├── topup/page.tsx
│       │       ├── orders/page.tsx
│       │       └── support/page.tsx
│       ├── components/
│       │   ├── ui/                  # ชิ้นส่วน UI พื้นฐานที่ใช้ซ้ำได้ทั้งเว็บ (SectionHeader ฯลฯ)
│       │   └── layout/              # โครงสร้างหลัก (AppShell, Sidebar, TopHeader, AnchorIsland, Footer, BackToTop)
│       ├── features/                # แยกตามโดเมนธุรกิจ (Feature-based Modules)
│       │   ├── home/                # หน้าแรก: HeroSection, OrderTicker, QuickActions, StatsGrid, AnnouncementBar + api.ts
│       │   ├── catalog/             # หมวดหมู่และสินค้า: CategoryCard, CategoryGrid, ProductCard, ProductGrid + api.ts
│       │   └── reviews/             # รีวิวลูกค้า: ReviewGrid
│       ├── hooks/                   # Custom React Hooks (useScrollSpy, useScrolledPast)
│       ├── lib/                     # ฟังก์ชันกลาง (api-client.ts, format.ts, cn.ts)
│       ├── mocks/                   # ข้อมูลจำลองระหว่างรอเชื่อม Backend
│       ├── config/                  # ตั้งค่าเมนู (navigation.ts) และข้อมูลเว็บไซต์ (site.ts)
│       └── types/                   # TypeScript Interfaces
└── backend/                         # โครงสร้าง NestJS แยกตามโดเมน (Module-per-Domain)
    ├── README.md                    # รายละเอียดคลาส Controller / Service / Repository ของแต่ละโมดูล
    └── src/modules/                 # auth, users, categories, products, orders, wallet, payments, reviews, tickets, stats
```

---

## 2. หลักการจัดโฟลเดอร์เมื่อต้องทำฟังก์ชันเพิ่ม

1. **เพิ่มหน้าหรือเมนูใหม่:**
   - เพิ่มรายการใน `frontend/src/config/navigation.ts` (จุดเดียวอัปเดตทั้ง Sidebar และ Anchor Island)
   - สร้างไฟล์หน้าเพจที่ `frontend/src/app/(store)/<route>/page.tsx`
2. **เพิ่มฟีเจอร์ใหม่ (เช่น ระบบคูปองส่วนลด `coupons`):**
   - **Shared:** เพิ่ม `CouponDto` ใน `packages/shared/src/index.ts`
   - **Frontend:** สร้างโฟลเดอร์ `frontend/src/features/coupons/` ด้านในประกอบด้วย `api.ts` และ `components/`
   - **Backend:** สร้างโฟลเดอร์ `backend/src/modules/coupons/` ด้านในประกอบด้วย `coupons.module.ts`, `coupons.controller.ts`, `coupons.service.ts`, `coupons.repository.ts`, และ `dto/`
3. **สลับจากข้อมูล Mock ไปใช้ Backend จริง:**
   - ตั้งค่า `NEXT_PUBLIC_USE_MOCKS=false` และ `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` ใน `.env.local` โดยไม่ต้องแก้โค้ดใน Component แม้แต่บรรทัดเดียว

---

## 3. คำสั่งรันโปรเจกต์

```powershell
cd e:\ouroboros-study\kaitan-store

# รันเซิร์ฟเวอร์พัฒนา Frontend (http://localhost:3000)
npm run dev:fe

# ตรวจสอบการ Build ของ Frontend
npm run build:fe
```
