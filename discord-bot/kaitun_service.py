import re
import secrets
import string
from typing import List, Tuple, Optional, Dict, Any
from database import Database

# Safe special characters for Roblox passwords
SAFE_SYMBOLS = "!@#$%^&*"
ROBLOX_USERNAME_CHARS = string.ascii_letters + string.digits


def generate_secure_password(length: int = 14) -> str:
    """สร้างรหัสผ่านที่ปลอดภัย สุ่มตัวอักษรพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และสัญลักษณ์ ไม่ซ้ำรูปแบบง่าย"""
    if length < 8:
        length = 8
    if length > 32:
        length = 32

    # บังคับให้มีครบทุกกลุ่ม
    req = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(SAFE_SYMBOLS),
    ]
    all_chars = string.ascii_letters + string.digits + SAFE_SYMBOLS
    rem = [secrets.choice(all_chars) for _ in range(length - len(req))]
    combined = req + rem
    
    # Shuffle ด้วย secrets
    shuffled = []
    while combined:
        idx = secrets.randbelow(len(combined))
        shuffled.append(combined.pop(idx))
    return "".join(shuffled)


def sanitize_username_prefix(prefix: str) -> str:
    """ทำความสะอาด Prefix ให้ถูกต้องตามกฎ Username ของ Roblox"""
    clean = re.sub(r"[^a-zA-Z0-9_]", "", prefix.strip())
    # Roblox Username ห้ามขึ้นต้นหรือลงท้ายด้วย _
    clean = clean.strip("_")
    # ความยาวไม่เกิน 12 ตัวอักษรสำหรับ Prefix เพื่อเหลือที่ให้ Random Suffix
    return clean[:12]


def generate_roblox_username(prefix: str = "kiZortShop", target_length: int = 15) -> str:
    """สร้าง Username ที่ถูกต้องตามกฎ Roblox (3-20 ตัวอักษร, ไม่ขึ้นต้น/ลงท้ายด้วย _)"""
    clean_prefix = sanitize_username_prefix(prefix)
    if not clean_prefix:
        clean_prefix = "User"

    target_length = max(min(target_length, 20), len(clean_prefix) + 4)
    suffix_needed = target_length - len(clean_prefix) - 1  # 1 for underscore separator

    if suffix_needed < 3:
        suffix_needed = 3

    # สร้าง Random Suffix (ตัวอักษรและตัวเลข)
    suffix = "".join(secrets.choice(ROBLOX_USERNAME_CHARS) for _ in range(suffix_needed))
    username = f"{clean_prefix}_{suffix}"

    # จำกัดความยาวไม่เกิน 20 ตัวอักษรตามข้อกำหนด Roblox
    return username[:20]


def parse_account_line(line: str) -> Optional[Tuple[str, str, Optional[str]]]:
    """แยกข้อมูล <username>|<password>|<cookie> หรือคั่นด้วยโคลอน/แท็บ"""
    cleaned = line.strip()
    if not cleaned:
        return None

    # ลองแยกด้วย | ก่อน
    if "|" in cleaned:
        parts = [p.strip() for p in cleaned.split("|")]
    elif ":" in cleaned:
        parts = [p.strip() for p in cleaned.split(":")]
    elif "\t" in cleaned:
        parts = [p.strip() for p in cleaned.split("\t")]
    else:
        parts = [p.strip() for p in cleaned.split()]

    if len(parts) >= 2:
        username = parts[0]
        password = parts[1]
        cookie = parts[2] if len(parts) >= 3 and parts[2] else None
        return username, password, cookie

    return None


class StockAddResult(tuple):
    """
    Subclass of tuple (success_count, failed_count, failed_lines)
    for backward compatibility with 3-tuple unpacking,
    with additional fields for password updates and duplicate account tracking.
    """
    def __new__(
        cls,
        success_count: int,
        failed_count: int,
        failed_lines: List[str],
        password_updated: Optional[List[Dict[str, str]]] = None,
        duplicates: Optional[List[str]] = None,
    ):
        return super().__new__(cls, (success_count, failed_count, failed_lines))

    def __init__(
        self,
        success_count: int,
        failed_count: int,
        failed_lines: List[str],
        password_updated: Optional[List[Dict[str, str]]] = None,
        duplicates: Optional[List[str]] = None,
    ):
        self.success_count = success_count
        self.failed_count = failed_count
        self.failed_lines = failed_lines
        self.password_updated = password_updated or []
        self.duplicates = duplicates or []


class KaitunService:
    def __init__(self, database: Database):
        self.database = database

    def generate_credentials_batch(
        self, prefix: str = "kiZortShop", count: int = 5, password_length: int = 14
    ) -> List[Tuple[str, str]]:
        """สุ่ม Username และ Password เป็นชุดตามจำนวนที่ต้องการโดยไม่ซ้ำกัน"""
        count = max(1, min(count, 50))  # จำกัดระหว่าง 1 ถึง 50 ชุดต่อครั้ง
        results: List[Tuple[str, str]] = []
        seen_usernames = set()
        seen_passwords = set()

        for _ in range(count):
            while True:
                u = generate_roblox_username(prefix)
                if u not in seen_usernames:
                    seen_usernames.add(u)
                    break

            while True:
                p = generate_secure_password(password_length)
                if p not in seen_passwords:
                    seen_passwords.add(p)
                    break

            results.append((u, p))

        return results

    def add_stock_from_text(self, text: str, user_id: int) -> StockAddResult:
        """เพิ่มบัญชีเข้าสตอกจากข้อความหลายบรรทัด ตรวจสอบบัญชีซ้ำและตรวจจับการเปลี่ยนรหัสผ่าน"""
        lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
        success_count = 0
        failed_count = 0
        failed_lines: List[str] = []
        password_updated: List[Dict[str, str]] = []
        duplicates: List[str] = []

        for line in lines:
            parsed = parse_account_line(line)
            if not parsed:
                failed_count += 1
                failed_lines.append(line)
                continue

            username, password, cookie = parsed
            status, old_acc = self.database.add_kaitun_account_smart(
                username=username,
                password=password,
                cookie=cookie,
                raw_line=line,
                user_id=user_id,
            )
            if status == "created":
                success_count += 1
            elif status == "password_updated":
                password_updated.append({
                    "username": username,
                    "old_password": old_acc.get("password", "") if old_acc else "",
                    "new_password": password,
                })
            elif status == "duplicate":
                failed_count += 1
                duplicates.append(username)
                failed_lines.append(f"{username} (ไอดีซ้ำในสต็อก)")
            else:
                failed_count += 1
                failed_lines.append(line)

        return StockAddResult(
            success_count=success_count,
            failed_count=failed_count,
            failed_lines=failed_lines,
            password_updated=password_updated,
            duplicates=duplicates,
        )

    def get_stock_summary(self) -> Dict[str, int]:
        """สรุปข้อมูลสต็อกทั้งหมด"""
        return self.database.get_kaitun_stats()

    def dispense_accounts(self, count: int, user_id: int) -> List[Dict[str, Any]]:
        """ตัดสต็อกและส่งมอบไอดีตามจำนวนที่ร้องขอ"""
        count = max(1, min(count, 20))
        return self.database.dispense_kaitun(count, user_id)

    def list_available_accounts(self, limit: int = 20) -> List[Dict[str, Any]]:
        """ดึงรายการไอดีที่พร้อมใช้งาน"""
        return self.database.list_available_kaitun(limit)

    def get_account(self, username: str) -> Optional[Dict[str, Any]]:
        """ดึงข้อมูลรายละเอียดของไอดีตาม Username"""
        return self.database.get_kaitun_account(username)

    def update_account(
        self,
        username: str,
        password: Optional[str] = None,
        farmed_maps: Optional[str] = None,
        details: Optional[str] = None,
        sale_status: Optional[str] = None,
        price: Optional[str] = None,
        actor: Optional[str] = None,
    ) -> bool:
        """อัปเดตข้อมูลรายละเอียดของไอดี (รหัสผ่าน, แมพที่ฟาร์ม, รายละเอียดของ, สถานะการขาย, ราคา)"""
        return self.database.update_kaitun_account(
            username=username,
            password=password,
            farmed_maps=farmed_maps,
            details=details,
            sale_status=sale_status,
            price=price,
            actor=actor,
        )

    def list_accounts(
        self,
        sale_status: Optional[str] = None,
        map_query: Optional[str] = None,
        limit: int = 25,
    ) -> List[Dict[str, Any]]:
        """ค้นหาและดึงรายการไอดีตามเงื่อนไข (ขายแล้ว/ยังไม่ขาย หรือแมพที่ฟาร์ม)"""
        return self.database.list_kaitun_accounts(
            sale_status=sale_status,
            map_query=map_query,
            limit=limit,
        )

    def delete_account(self, username: str) -> bool:
        """นำไอดีออกจากคลังสต็อก (ลบออกจากฐานข้อมูล)"""
        return self.database.delete_kaitun_account(username.strip())
