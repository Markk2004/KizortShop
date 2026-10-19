# Discord Key Validation Bot

บอท Discord สำหรับรับ key ที่ผู้ใช้ได้มาด้วยตนเอง หรือประมวลผลลิงก์ผ่าน API ที่ได้รับอนุญาต ตรวจสอบรูปแบบ (Format Validation) บันทึก hash ลง SQLite ป้องกันการนำ key เดิมมาใช้ซ้ำ (Redeem Prevention) และตอบผลลัพธ์ผ่านคำสั่ง Slash Command `/getkey`, `/process`, `/redeem`, `/ask` และ `/help`

> **หมายเหตุความปลอดภัย:** บอทนี้ทำงานเป็นระบบตรวจสอบและบันทึกคีย์ที่ผู้ใช้กรอกเข้ามา หรือเชื่อมต่อผ่าน API ภายนอกที่ได้รับอนุญาตอย่างเป็นทางการเท่านั้น **ไม่มี** และ **ไม่สนับสนุน** ระบบเปิดหน้าเว็บอัตโนมัติ, การกดโฆษณา, CAPTCHA bypass, redirect bypass, Zapi bypass หรือการดึงคีย์อัตโนมัติจาก Platoboost, Luarmor, LootLabs หรือบริการภายนอกใดๆ ทั้งสิ้น

---

## สถาปัตยกรรมและโครงสร้างไฟล์

```text
discord-bot/
├── .env.example          # ตัวอย่างการตั้งค่า Environment Variables
├── .gitignore            # กรอง token, venv, sqlite database ไม่ให้หลุดขึ้น Git
├── requirements.txt      # รายการ dependencies (discord.py, python-dotenv, pytest)
├── config.py             # จัดการโหลด Settings และตรวจสอบความถูกต้องของการตั้งค่า
├── database.py           # ตัวจัดการฐานข้อมูล SQLite (บันทึก SHA-256 hash)
├── key_service.py        # Logic ตรวจสอบความถูกต้องของ Key และสถานะการ Redeem
├── provider_client.py    # Client สำหรับเชื่อมต่อ Provider API ที่ได้รับอนุญาต พร้อมตรวจ Host และ Redirect
├── process_service.py    # Service ประสานงานระหว่าง Provider และ Key Validation
├── bot.py                # Discord Client, Slash Commands, Animated Progress, และ Interactive Buttons
├── pytest.ini            # กำหนดค่า pythonpath สำหรับ unit tests
└── tests/                # Unit Tests ครอบคลุมการทำงานทุกส่วน (20 tests)
```

---

## รายการคำสั่งทั้งหมด (Available Commands)

| คำสั่ง | พารามิเตอร์ | คำอธิบาย |
| :--- | :--- | :--- |
| `/getkey` | `[ephemeral]` | **รับคีย์ใหม่ทันที** (ไม่ต้องกรอกคีย์เลย มีแถบ Processing และปุ่ม Copy Key) |
| `/process` | `link:<str>` | **ประมวลผลลิงก์** จากระบบ Partner/Provider ที่ได้รับอนุญาต แสดงเวลาและปุ่ม Copy Key |
| `/redeem` | `[key]`, `[ephemeral]` | ยืนยันคีย์ของคุณ หรือกด Enter เพื่อรับคีย์ |
| `/ask` | `message:<str>` | พูดคุย สอบถามข้อมูล หรือขอความช่วยเหลือจากบอท |
| `/roblox_status` | `[ephemeral]` | **ตรวจสถานะเกม** เช็กว่า Roblox หรือ MuMu Player กำลังเล่นอยู่หรือไม่ พร้อม PID, RAM, Uptime |
| `/roblox_screen` | `[ephemeral]` | **แคปภาพหน้าจอสด** สั่งแคปภาพหน้าจอเกม Roblox / คอมพิวเตอร์ส่งมาให้ดูใน Discord ทันที |
| `/help` | `[ephemeral]` | แสดงคู่มือและรายการคำสั่งทั้งหมดในรูปแบบ Embed |

---

## ขั้นตอนการติดตั้งและการตั้งค่าบอท

### 1. การสร้างและตั้งค่าบอทบน Discord Developer Portal
1. เข้าไปที่ [Discord Developer Portal](https://discord.com/developers/applications) แล้วกด **New Application**
2. ไปที่เมนู **Bot**:
   - กด **Reset Token** เพื่อรับ Bot Token
   - **ข้อควรระวัง:** ห้ามส่ง Token นี้ให้ผู้อื่น หรืออัปโหลดขึ้น GitHub/สาธารณะเด็ดขาด
3. ไปที่เมนู **OAuth2 > URL Generator**:
   - ในช่อง **Scopes** ให้เลือก: `bot`, `applications.commands`
   - ในช่อง **Bot Permissions** ให้เลือก: `View Channels`, `Send Messages`, `Read Message History`
4. คัดลอก URL ที่สร้างขึ้น นำไปเปิดในเบราว์เซอร์เพื่อเชิญบอทเข้าสู่เซิร์ฟเวอร์ Discord ของคุณ

---

### 2. การตั้งค่า Environment Variables
1. คัดลอกไฟล์ `.env.example` เป็น `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. เปิดไฟล์ `.env` ด้วย Text Editor แล้วกรอกค่าการตั้งค่า:
   ```dotenv
   DISCORD_TOKEN=your_actual_bot_token_here
   DATABASE_PATH=data/bot.sqlite3
   KEY_PREFIX=FREE_
   KEY_HEX_LENGTH=32

   # Authorized Provider Configuration (Optional)
   PROVIDER_ENABLED=false
   PROVIDER_BASE_URL=
   PROVIDER_API_KEY=
   PROVIDER_ALLOWED_HOST=
   ```

---

### 3. แนวทางความปลอดภัย (Security Guidelines)
- **API Key & Secret Hygiene:**
  - เก็บ Provider API key ใน environment variable (`.env`) เท่านั้น ห้ามใส่ใน source code หรือ commit ขึ้น git
  - หาก API key ถูกส่งในแชตหรือสาธารณะ ให้ทำการ Revoke และสร้างใหม่ทันที
  - บอทจะไม่ log หรือแสดง URL เต็มที่มี ticket/token, Discord Token หรือ Provider API Key ออกทางหน้าจอหรือ log
- **Redirect & Host Security:**
  - ลิงก์ที่ส่งเข้ามาต้องเป็น `https://` เท่านั้น
  - ระบบจะตรวจสอบ Host กับ Allowlist (`PROVIDER_ALLOWED_HOST`) เสมอ
  - บอทใช้ SafeRedirectHandler ซึ่งจะไม่อนุญาตให้เกิดการ redirect ไปยัง host ที่ไม่อยู่ใน allowlist
  - ไม่อนุญาตและบล็อกการเชื่อมต่อไปยังโดเมน checkpoint/ad-gate ภายนอก (เช่น Platoboost, Luarmor, LootLabs)

---

### 4. การรันบอท (Running the Bot)
เปิด PowerShell ในโฟลเดอร์ `discord-bot` และสั่งรัน:

```powershell
cd E:\ouroboros-study\discord-bot
.\.venv\Scripts\Activate.ps1
python bot.py
```

เมื่อบอทออนไลน์ จะแสดงข้อความ Log ใน Terminal:
```text
Application command tree synced successfully.
Bot logged in successfully as <BotName> (ID: <BotID>)
```

---

### 5. การรัน Unit Tests
สามารถรันชุดการทดสอบทั้งหมดได้ด้วยคำสั่ง:
```powershell
.\.venv\Scripts\pytest.exe -v
```

---

## การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

1. **Token ผิดพลาด (`discord.errors.LoginFailure`):**
   - ตรวจสอบว่าในไฟล์ `.env` ใส่ `DISCORD_TOKEN` ถูกต้องครบถ้วน ไม่มีเว้นวรรคส่วนเกิน
2. **Slash Command ไม่ขึ้นใน Discord:**
   - ตรวจสอบว่าตอนเชิญบอท ได้เลือก Scope `applications.commands` หรือไม่
   - กด `Ctrl + R` ใน Discord เพื่อรีเฟรชแคชของคำสั่ง
3. **Provider Not Configured (`provider_not_configured`):**
   - คำสั่ง `/process` ต้องการการตั้งค่า `PROVIDER_ENABLED=true` และ `PROVIDER_BASE_URL` ในไฟล์ `.env` หากยังไม่ได้ตั้งค่า ระบบจะปฏิเสธการประมวลผลเพื่อความปลอดภัย
