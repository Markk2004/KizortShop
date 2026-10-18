# KAITAN STORE — Backend Architecture (NestJS + Prisma + PostgreSQL)

โครงสร้างฝั่ง Backend ออกแบบแยกเป็น **Module-per-Domain** โดยแต่ละโมดูลแบ่งชั้นชัดเจนเพื่อง่ายต่อการขยายฟีเจอร์และเขียน Unit Test

## โครงสร้างโฟลเดอร์และหน้าที่ของแต่ละคลาส

```text
backend/
├── prisma/
│   └── schema.prisma                # โมเดลฐานข้อมูล PostgreSQL (User, Wallet, Category, Product, AccountStock, Order, TopupTransaction, Review, Ticket)
└── src/
    ├── main.ts                      # Bootstrap NestJS, ValidationPipe, CORS, Swagger (/api/docs)
    ├── app.module.ts                # Root Module รวมทุก Domain Module
    ├── config/
    │   └── env.validation.ts        # ตรวจสอบตัวแปร .env (DATABASE_URL, JWT_SECRET, PAYMENT_API_KEY)
    ├── common/
    │   ├── guards/                  # JwtAuthGuard, RolesGuard (Admin / Customer)
    │   ├── decorators/              # @CurrentUser(), @Roles()
    │   ├── filters/                 # AllExceptionsFilter (แปลง error เป็นรูปแบบมาตรฐาน)
    │   └── interceptors/            # TransformInterceptor
    ├── prisma/
    │   ├── prisma.module.ts
    │   └── prisma.service.ts        # จัดการ Database Connection Pool
    └── modules/
        ├── admin/                   # ฟังก์ชันสำหรับผู้ดูแลระบบ (Admin Dashboard, จัดการสต็อก, อนุมัติสลิป, แบนผู้ใช้)
        │   ├── controllers/
        │   ├── services/
        │   ├── dto/
        │   └── admin.module.ts
        ├── member/                  # ฟังก์ชันเฉพาะสมาชิกทั่วไป (โปรไฟล์ส่วนตัว, ประวัติออเดอร์, การตั้งค่า)
        │   ├── controllers/
        │   ├── services/
        │   ├── dto/
        │   └── member.module.ts
        ├── auth/                    # ระบบสมัครสมาชิก / เข้าสู่ระบบ / JWT / Discord OAuth
        ├── users/                   # ข้อมูลผู้ใช้และโปรไฟล์
        ├── categories/              # หมวดหมู่เกม (Blox Fruits, Anime Dice, ฯลฯ)
        ├── products/                # รายการสินค้า + สต็อกไอดีที่เข้ารหัส (Account Vault)
        ├── orders/                  # สั่งซื้อไอดี + ตัดสต็อกแบบ Atomic Transaction + ส่งรหัสอัตโนมัติ
        ├── wallet/                  # กระเป๋าเครดิตผู้ใช้ + ประวัติการเคลื่อนไหวเครดิต
        ├── payments/                # Webhook รับยอด PromptPay QR & TrueMoney Angpao
        ├── reviews/                 # รีวิวจากผู้ซื้อจริง (ตรวจสอบจาก Order ที่สำเร็จ)
        ├── tickets/                 # ระบบแจ้งปัญหาและเคลมไอดีพร้อมลิงก์วิดีโอหลักฐาน
        └── stats/                   # สถิติภาพรวมของร้าน (Cache ด้วย Redis/In-memory)
```

## มาตรฐานการจัดคลาสภายในแต่ละ Module

ทุกโฟลเดอร์ภายใต้ `src/modules/<feature>/` ใช้โครงสร้างเดียวกันทั้งหมด:

| ไฟล์ | คลาส | หน้าที่หลัก |
|---|---|---|
| `<feature>.module.ts` | `<Feature>Module` | ลงทะเบียน Controller, Service, Repository และประกาศ Dependency |
| `<feature>.controller.ts` | `<Feature>Controller` | รับ HTTP Request, ตรวจสิทธิ์ Guard, แปลงพารามิเตอร์ด้วย DTO แล้วส่งต่อให้ Service |
| `<feature>.service.ts` | `<Feature>Service` | บรรจุ Business Logic ทั้งหมด เช่น ตรวจยอดเงิน, ล็อกสต็อก, คำนวณส่วนลด |
| `<feature>.repository.ts` | `<Feature>Repository` | คิวรีฐานข้อมูลผ่าน `PrismaService` แยกออกจาก Business Logic |
| `dto/*.dto.ts` | `Create<Feature>Dto`, `Update<Feature>Dto` | ตรวจสอบข้อมูลขาเข้าด้วย `class-validator` |
| `entities/*.entity.ts` | `<Feature>Entity` | โครงสร้างข้อมูลขาออก (ซิงค์กับ `@kaitan/shared`) |
