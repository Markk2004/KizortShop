from datetime import datetime, timezone
import logging
import os
import sqlite3
import hmac
import hashlib
import uuid
import json
import requests
import threading
from typing import Optional, Dict, Any, List, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Ensure .env is loaded before evaluating module-level constants
_base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_base_dir, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qidraqabrlnuurnlkwko.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZHJhcWFicmxudXVybmxrd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQwMzQ5MSwiZXhwIjoyMTA3OTc5NDkxfQ.c_1QBE2T4ujEscyHUPuzkXnHW33o8KHXKyKy99eJiGM"
)
STOCK_ENCRYPTION_SECRET = os.getenv("STOCK_ENCRYPTION_SECRET", "kz_store_aes256_gcm_stock_vault_secret_2026")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:4000").rstrip("/")
BOT_API_KEY = os.getenv("BOT_API_KEY", "kz_internal_sync_api_key_2026_9f8c12a7")

def _get_aes_key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode('utf-8')).digest()

def encrypt_credential(plain_text: str, secret: str = STOCK_ENCRYPTION_SECRET) -> str:
    key = _get_aes_key(secret)
    aesgcm = AESGCM(key)
    iv = os.urandom(12)
    ct_with_tag = aesgcm.encrypt(iv, plain_text.encode('utf-8'), None)
    ciphertext = ct_with_tag[:-16]
    tag = ct_with_tag[-16:]
    return f"{iv.hex()}:{tag.hex()}:{ciphertext.hex()}"

def decrypt_credential(cipher_payload: str, secret: str = STOCK_ENCRYPTION_SECRET) -> str:
    try:
        parts = cipher_payload.split(":")
        if len(parts) != 3:
            return cipher_payload
        iv = bytes.fromhex(parts[0])
        tag = bytes.fromhex(parts[1])
        ciphertext = bytes.fromhex(parts[2])
        key = _get_aes_key(secret)
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(iv, ciphertext + tag, None)
        return decrypted.decode('utf-8')
    except Exception:
        return cipher_payload

def hash_credential(username: str, secret: str = STOCK_ENCRYPTION_SECRET) -> str:
    return hmac.new(secret.encode('utf-8'), username.strip().lower().encode('utf-8'), hashlib.sha256).hexdigest()

def mask_identity(username: str) -> str:
    u = username.strip().lower()
    if len(u) <= 4:
        return f"{u[:2]}***"
    return f"{u[:4]}***"

def _mask_hash(h: str) -> str:
    if len(h) <= 8:
        return "***"
    return f"{h[:4]}...{h[-4:]}"


class Database:
    def __init__(self, path: str):
        self.path = path
        self._connection: Optional[sqlite3.Connection] = None
        self._db_lock = threading.Lock()
        self._is_test_env = "test" in os.path.basename(path).lower() or "pytest" in path.lower() or os.getenv("TESTING") == "1"
        service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or SUPABASE_SERVICE_ROLE_KEY
        self._supabase_headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self._default_product_id: Optional[str] = None

    @property
    def connection(self) -> sqlite3.Connection:
        if self._connection is None:
            self._ensure_parent_dir()
            self._connection = sqlite3.connect(self.path, check_same_thread=False)
            self._connection.row_factory = sqlite3.Row
            if not self._is_test_env:
                try:
                    self._connection.execute("PRAGMA journal_mode=WAL;")
                    self._connection.execute("PRAGMA busy_timeout=5000;")
                except Exception:
                    pass
        return self._connection

    def _ensure_parent_dir(self) -> None:
        directory = os.path.dirname(self.path)
        if directory:
            os.makedirs(directory, exist_ok=True)

    def _get_default_product_id(self) -> str:
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/Product?select=id,code&order=createdAt.desc&limit=10",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code == 200 and resp.json():
                rows = resp.json()
                # Prefer user's real product first so stock count increments on their product
                for r in rows:
                    if r.get("code") != "KAITUN-VAULT-POOL":
                        self._default_product_id = r["id"]
                        return self._default_product_id
                self._default_product_id = rows[0]["id"]
                return self._default_product_id
        except Exception as e:
            logger.error("Failed to fetch default product from Supabase: %s", e)

        return self._default_product_id or "9156b43e-ff6b-499d-b5cc-550f0a2b035d"

    def initialize(self) -> None:
        conn = self.connection
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS redeemed_keys (
                    key_hash TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    redeemed_at TEXT NOT NULL
                );
                """
            )
            if self._is_test_env:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS kaitun_accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        password TEXT NOT NULL,
                        cookie TEXT,
                        raw_line TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'available',
                        farmed_maps TEXT DEFAULT '',
                        details TEXT DEFAULT '',
                        sale_status TEXT DEFAULT 'unsold',
                        price TEXT DEFAULT '',
                        added_by INTEGER NOT NULL,
                        added_at TEXT NOT NULL,
                        used_by INTEGER,
                        used_at TEXT
                    );
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS expenses (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        category TEXT NOT NULL,
                        amount REAL NOT NULL,
                        note TEXT,
                        paidAt TEXT NOT NULL,
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL
                    );
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tickets (
                        id TEXT PRIMARY KEY,
                        userId TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        detail TEXT NOT NULL,
                        orderId TEXT,
                        status TEXT NOT NULL DEFAULT 'OPEN',
                        createdAt TEXT NOT NULL,
                        updatedAt TEXT NOT NULL
                    );
                    """
                )
        logger.info("Database initialized successfully (test_env=%s).", self._is_test_env)

    def find_key(self, key_hash: str) -> Optional[Dict[str, Any]]:
        cursor = self.connection.cursor()
        cursor.execute(
            "SELECT key_hash, user_id, redeemed_at FROM redeemed_keys WHERE key_hash = ?",
            (key_hash,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "key_hash": row["key_hash"],
            "user_id": row["user_id"],
            "redeemed_at": row["redeemed_at"],
        }

    def insert_key(self, key_hash: str, user_id: int) -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            with self.connection:
                self.connection.execute(
                    "INSERT INTO redeemed_keys (key_hash, user_id, redeemed_at) VALUES (?, ?, ?)",
                    (key_hash, user_id, now_iso),
                )
            logger.info("Successfully redeemed key [hash: %s] by user %s", _mask_hash(key_hash), user_id)
            return True
        except sqlite3.IntegrityError:
            logger.warning("Duplicate key attempt [hash: %s] by user %s", _mask_hash(key_hash), user_id)
            return False

    # --- TEST ENVIRONMENT LOCAL HANDLERS ---

    def _local_get_account(self, username: str) -> Optional[Dict[str, Any]]:
        u_clean = username.split("|")[0].split(":")[0].strip()
        cursor = self.connection.cursor()
        cursor.execute(
            "SELECT id, username, password, cookie, status, farmed_maps, details, sale_status, price, added_at, used_at FROM kaitun_accounts WHERE username = ? COLLATE NOCASE",
            (u_clean,),
        )
        row = cursor.fetchone()
        if not row and u_clean:
            cursor.execute(
                "SELECT id, username, password, cookie, status, farmed_maps, details, sale_status, price, added_at, used_at FROM kaitun_accounts WHERE username LIKE ? COLLATE NOCASE ORDER BY id DESC LIMIT 1",
                (f"%{u_clean}%",),
            )
            row = cursor.fetchone()
        return dict(row) if row else None

    def _local_add_account(self, username, password, cookie, raw_line, user_id, price=None, details=None, farmed_maps=None):
        existing = self._local_get_account(username)
        if existing:
            if existing.get("password") == password:
                if price or details or farmed_maps:
                    self._local_update(username, None, farmed_maps, details, None, price)
                return "duplicate", existing
            else:
                with self.connection:
                    self.connection.execute(
                        "UPDATE kaitun_accounts SET password = ?, raw_line = ?, cookie = COALESCE(?, cookie) WHERE id = ?",
                        (password, raw_line, cookie, existing["id"]),
                    )
                if price or details or farmed_maps:
                    self._local_update(username, None, farmed_maps, details, None, price)
                return "password_updated", existing
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.connection:
            self.connection.execute(
                "INSERT INTO kaitun_accounts (username, password, cookie, raw_line, status, added_by, added_at, price, details, farmed_maps) VALUES (?, ?, ?, ?, 'available', ?, ?, ?, ?, ?)",
                (username, password, cookie, raw_line, user_id, now_iso, price or "", details or "", farmed_maps or ""),
            )
        return "created", None

    def _ensure_local_expenses_table(self):
        with self.connection:
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS expenses (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    amount REAL NOT NULL,
                    note TEXT,
                    paidAt TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                """
            )

    def _local_add_expense(self, title, amount, category="OTHER", note=None):
        self._ensure_local_expenses_table()
        now_iso = datetime.now(timezone.utc).isoformat()
        exp_id = str(uuid.uuid4())
        with self.connection:
            self.connection.execute(
                "INSERT INTO expenses (id, title, category, amount, note, paidAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (exp_id, title.strip(), category.upper(), float(amount), note, now_iso, now_iso, now_iso),
            )
        return {
            "id": exp_id,
            "title": title.strip(),
            "category": category.upper(),
            "amount": float(amount),
            "note": note,
            "paidAt": now_iso,
        }

    def _local_list_expenses(self, limit=15):
        self._ensure_local_expenses_table()
        cur = self.connection.cursor()
        cur.execute("SELECT * FROM expenses ORDER BY paidAt DESC LIMIT ?", (limit,))
        return [dict(r) for r in cur.fetchall()]

    def _local_delete_expense(self, expense_id):
        self._ensure_local_expenses_table()
        expenses = self._local_list_expenses(limit=25)
        if not expenses:
            return None
        target = None
        q = (expense_id or "").strip()
        if q.lower() in ("latest", "ล่าสุด", "อันล่าสุด", "รายการล่าสุด"):
            target = expenses[0]
        else:
            for e in expenses:
                if e["id"] == q or e["id"].startswith(q) or q.lower() in e["title"].lower():
                    target = e
                    break
        if not target:
            target = {"id": q, "title": q, "amount": 0.0}

        real_id = target.get("id")
        with self.connection:
            cur = self.connection.cursor()
            cur.execute("DELETE FROM expenses WHERE id = ?", (real_id,))
            if cur.rowcount > 0:
                return target
        return target if target.get("amount", 0) > 0 else None

    def _local_stats(self):
        cursor = self.connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM kaitun_accounts")
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM kaitun_accounts WHERE sale_status = 'sold' OR status = 'used'")
        sold = cursor.fetchone()[0]
        available = max(0, total - sold)
        return {"available": available, "used": sold, "sold": sold, "total": total}

    def _local_dispense(self, count: int, user_id: int):
        cursor = self.connection.cursor()
        cursor.execute("SELECT id, username, password, cookie, raw_line FROM kaitun_accounts WHERE status = 'available' ORDER BY id ASC LIMIT ?", (count,))
        rows = cursor.fetchall()
        if not rows:
            return []
        ids = [r["id"] for r in rows]
        now_iso = datetime.now(timezone.utc).isoformat()
        placeholders = ",".join("?" for _ in ids)
        with self.connection:
            self.connection.execute(f"UPDATE kaitun_accounts SET status = 'used', sale_status = 'sold', used_by = ?, used_at = ? WHERE id IN ({placeholders})", [user_id, now_iso] + ids)
        return [dict(r) for r in rows]

    def _local_update(self, username, password, farmed_maps, details, sale_status, price):
        updates, params = [], []
        if password is not None:
            updates.append("password = ?"); params.append(password)
        if farmed_maps is not None:
            updates.append("farmed_maps = ?"); params.append(farmed_maps)
        if details is not None:
            updates.append("details = ?"); params.append(details)
        if sale_status is not None:
            updates.append("sale_status = ?"); params.append(sale_status)
            updates.append("status = ?"); params.append("used" if sale_status == "sold" else "available")
        if price is not None:
            updates.append("price = ?"); params.append(price)
        if not updates:
            return False
        params.append(username)
        with self.connection:
            cur = self.connection.cursor()
            cur.execute(f"UPDATE kaitun_accounts SET {', '.join(updates)} WHERE username = ? COLLATE NOCASE", params)
            return cur.rowcount > 0

    def _local_list(self, sale_status=None, map_query=None, limit=50):
        conds, params = [], []
        if sale_status:
            conds.append("sale_status = ? COLLATE NOCASE"); params.append(sale_status)
        if map_query:
            conds.append("farmed_maps LIKE ?"); params.append(f"%{map_query}%")
        where = f"WHERE {' AND '.join(conds)}" if conds else ""
        params.append(limit)
        cur = self.connection.cursor()
        cur.execute(f"SELECT * FROM kaitun_accounts {where} ORDER BY id DESC LIMIT ?", params)
        return [dict(r) for r in cur.fetchall()]

    # --- SUPABASE 2-WAY SYNC KAITUN IMPLEMENTATION ---

    def _map_stock_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Supabase AccountStock row into kaitun_account dict format"""
        decrypted_raw = decrypt_credential(row.get("credentials", ""))
        parts = (
            [p.strip() for p in decrypted_raw.split("|")]
            if "|" in decrypted_raw
            else [p.strip() for p in decrypted_raw.split(":")]
        )
        username = row.get("username") or (parts[0] if parts else "")
        password = parts[1] if len(parts) >= 2 else ""

        sale_status = "sold" if row.get("status") == "SOLD" else "unsold"
        legacy_status = "used" if sale_status == "sold" else "available"

        return {
            "id": row.get("id"),
            "serialCode": row.get("serialCode"),
            "username": username,
            "password": password,
            "cookie": row.get("cookie"),
            "status": legacy_status,
            "sale_status": sale_status,
            "farmed_maps": row.get("farmedMaps") or "",
            "details": row.get("details") or "",
            "price": row.get("sellingPriceText") or "",
            "added_by": row.get("addedByDiscordId") or 0,
            "added_at": row.get("createdAt") or "",
            "used_at": row.get("soldAt") or "",
        }

    def get_kaitun_account(self, username: str, exact_only: bool = False) -> Optional[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_get_account(username)

        u_clean = username.split("|")[0].split(":")[0].strip()
        if not u_clean:
            return None

        cred_hash = hash_credential(u_clean.lower())
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?credentialHash=eq.{cred_hash}&select=*",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code == 200 and resp.json():
                return self._map_stock_row(resp.json()[0])

            # Fallback 1: Exact case-insensitive username match
            resp2 = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?username=ilike.{u_clean}&select=*",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp2.status_code == 200 and resp2.json():
                return self._map_stock_row(resp2.json()[0])

            if not exact_only:
                # Fallback 2: Substring / partial username match
                resp3 = requests.get(
                    f"{SUPABASE_URL}/rest/v1/AccountStock?username=ilike.*{u_clean}*&order=createdAt.desc&limit=1&select=*",
                    headers=self._supabase_headers,
                    timeout=5
                )
                if resp3.status_code == 200 and resp3.json():
                    return self._map_stock_row(resp3.json()[0])

                # Fallback 3: Serial code match
                resp4 = requests.get(
                    f"{SUPABASE_URL}/rest/v1/AccountStock?serialCode=ilike.*{u_clean}*&order=createdAt.desc&limit=1&select=*",
                    headers=self._supabase_headers,
                    timeout=5
                )
                if resp4.status_code == 200 and resp4.json():
                    return self._map_stock_row(resp4.json()[0])
        except Exception as e:
            logger.error("Supabase error in get_kaitun_account: %s", e)
        return None

    def add_kaitun_account_smart(
        self,
        username: str,
        password: str,
        cookie: Optional[str],
        raw_line: str,
        user_id: int,
        price: Optional[str] = None,
        details: Optional[str] = None,
        farmed_maps: Optional[str] = None,
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        if self._is_test_env:
            return self._local_add_account(username, password, cookie, raw_line, user_id, price=price, details=details, farmed_maps=farmed_maps)

        # Direct Supabase REST (Primary Source of Truth)
        existing = self.get_kaitun_account(username, exact_only=True)
        if existing:
            patch_data: Dict[str, Any] = {"updatedAt": datetime.now(timezone.utc).isoformat()}
            if price is not None:
                patch_data["sellingPriceText"] = str(price)
            if details is not None:
                patch_data["details"] = str(details)
            if farmed_maps is not None:
                patch_data["farmedMaps"] = str(farmed_maps)

            if existing.get("password") == password:
                if len(patch_data) > 1:
                    try:
                        requests.patch(
                            f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{existing['id']}",
                            headers=self._supabase_headers,
                            data=json.dumps(patch_data),
                            timeout=5,
                        )
                    except Exception as e:
                        logger.warning("Failed to update extra account fields on Supabase: %s", e)
                logger.warning("Duplicate kaitun account rejected on Supabase: '%s'", username)
                return "duplicate", existing
            else:
                # Password updated
                cred_str = f"{username}:{password}"
                if cookie:
                    cred_str += f":{cookie}"
                encrypted_cred = encrypt_credential(cred_str)

                patch_data["credentials"] = encrypted_cred
                if cookie:
                    patch_data["cookie"] = cookie

                try:
                    requests.patch(
                        f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{existing['id']}",
                        headers=self._supabase_headers,
                        data=json.dumps(patch_data),
                        timeout=5
                    )
                    logger.info("Password updated on Supabase for account '%s'", username)
                    try:
                        embed_pw = {
                            "title": f"🔑 [อัปเดตรหัสผ่านไอดี] {username}",
                            "description": "ตรวจพบรหัสผ่านใหม่สำหรับไอดีเดิมในคลัง ระบบทำการอัปเดตรหัสผ่านเรียบร้อยแล้ว",
                            "color": 0xF59E0B,
                            "fields": [
                                {"name": "👤 บัญชี (Username)", "value": f"`{username}`", "inline": True},
                                {"name": "🏷️ สถานะ", "value": "🔑 **อัปเดตรหัสผ่านแล้ว**", "inline": True},
                            ],
                            "footer": {"text": f"อัปเดตโดย Discord ID: {user_id} • ซิงค์ทุกระบบพร้อมกัน"},
                        }
                        if price:
                            embed_pw["fields"].append({"name": "💰 ราคา", "value": f"฿{price}", "inline": True})
                        self.broadcast_webhooks(["stocks", "kaitun_sync"], embed_pw)
                    except Exception as e:
                        logger.warning("Failed to broadcast password update webhook: %s", e)
                    return "password_updated", existing
                except Exception as e:
                    logger.error("Failed to update password on Supabase: %s", e)
                    return "duplicate", existing

        # Create new on Supabase
        product_id = self._get_default_product_id()
        cred_hash = hash_credential(username)
        masked_id = mask_identity(username)
        cred_str = f"{username}:{password}"
        if cookie:
            cred_str += f":{cookie}"
        encrypted_cred = encrypt_credential(cred_str)

        now_iso = datetime.now(timezone.utc).isoformat()
        serial = f"STK-DISC-{int(datetime.now().timestamp()) % 100000:05d}-{username[:6].upper()}"

        record = {
            "id": str(uuid.uuid4()),
            "serialCode": serial,
            "productId": product_id,
            "credentialFormat": "USER_PASS",
            "credentialHash": cred_hash,
            "maskedIdentity": masked_id,
            "credentials": encrypted_cred,
            "username": username,
            "cookie": cookie,
            "addedSource": "DISCORD",
            "addedByDiscordId": str(user_id),
            "status": "AVAILABLE",
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }
        if price is not None:
            record["sellingPriceText"] = str(price)
        if details is not None:
            record["details"] = str(details)
        if farmed_maps is not None:
            record["farmedMaps"] = str(farmed_maps)

        try:
            resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/AccountStock",
                headers=self._supabase_headers,
                data=json.dumps(record),
                timeout=5
            )
            if resp.status_code in (200, 201):
                logger.info("Successfully created kaitun account on Supabase: '%s'", username)
                try:
                    embed_created = {
                        "title": f"📦 [เพิ่มสต็อกไอดีใหม่] {username}",
                        "description": "นำเข้าบัญชีใหม่เข้าสู่คลังสต็อกพร้อมขายเรียบร้อยแล้ว",
                        "color": 0x10B981,
                        "fields": [
                            {"name": "👤 บัญชี (Username)", "value": f"`{username}`", "inline": True},
                            {"name": "🔖 Serial Code", "value": f"`{serial}`", "inline": True},
                            {"name": "🏷️ สถานะ", "value": "🟢 **พร้อมขาย (Available)**", "inline": True},
                        ],
                        "footer": {"text": f"เพิ่มโดย Discord ID: {user_id} • ซิงค์คลังสต็อกและเว็บไซต์ทันที"},
                    }
                    if price:
                        embed_created["fields"].append({"name": "💰 ราคา", "value": f"฿{price}", "inline": True})
                    if details:
                        embed_created["fields"].append({"name": "📝 รายละเอียด", "value": f"```{details[:300]}```", "inline": False})
                    self.broadcast_webhooks(["stocks"], embed_created)
                except Exception as e:
                    logger.warning("Failed to broadcast stock created webhook: %s", e)
                return "created", None
            elif resp.status_code == 409 and ("credentialHash" in resp.text or "duplicate" in resp.text.lower()):
                logger.warning("Supabase duplicate hash for account '%s': %s", username, resp.text)
                return "duplicate", None
            else:
                logger.error("Supabase returned %s: %s", resp.status_code, resp.text)
                return "failed", None
        except Exception as e:
            logger.error("Supabase insert error: %s", e)
            return "failed", None

    def add_kaitun_account(
        self,
        username: str,
        password: str,
        cookie: Optional[str],
        raw_line: str,
        user_id: int,
        price: Optional[str] = None,
        details: Optional[str] = None,
        farmed_maps: Optional[str] = None,
    ) -> bool:
        status, _ = self.add_kaitun_account_smart(
            username=username,
            password=password,
            cookie=cookie,
            raw_line=raw_line,
            user_id=user_id,
            price=price,
            details=details,
            farmed_maps=farmed_maps,
        )
        return status == "created"

    def get_kaitun_stats(self) -> Dict[str, int]:
        if self._is_test_env:
            return self._local_stats()

        try:
            resp_avail = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?status=eq.AVAILABLE&select=id",
                headers={**self._supabase_headers, "Range-Unit": "items", "Prefer": "count=exact"},
                timeout=5
            )
            resp_sold = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?status=eq.SOLD&select=id",
                headers={**self._supabase_headers, "Range-Unit": "items", "Prefer": "count=exact"},
                timeout=5
            )

            available = len(resp_avail.json()) if resp_avail.status_code == 200 else 0
            sold = len(resp_sold.json()) if resp_sold.status_code == 200 else 0
            total = available + sold

            return {
                "available": available,
                "used": sold,
                "sold": sold,
                "total": total,
            }
        except Exception as e:
            logger.error("Error getting stats from Supabase: %s", e)
            return {"available": 0, "used": 0, "sold": 0, "total": 0}

    def get_financial_stats(self) -> Dict[str, Any]:
        import re
        if self._is_test_env:
            cur = self.connection.cursor()
            cur.execute("SELECT status, sale_status, price FROM kaitun_accounts")
            rows = cur.fetchall()
            sold_count = 0
            available_count = 0
            priced_available_count = 0
            unpriced_available_count = 0
            total_revenue = 0.0
            inventory_value = 0.0
            for r in rows:
                is_sold = (r["sale_status"] == "sold" or r["status"] == "used")
                raw_p = str(r["price"] or "")
                nums = re.findall(r"[\d.]+", raw_p)
                p = float(nums[0]) if nums else 0.0
                if is_sold:
                    sold_count += 1
                    total_revenue += p
                else:
                    available_count += 1
                    if p > 0:
                        priced_available_count += 1
                        inventory_value += p
                    else:
                        unpriced_available_count += 1
            cur.execute("SELECT SUM(amount) FROM expenses")
            row_exp = cur.fetchone()
            total_expenses = float(row_exp[0] or 0.0) if row_exp and row_exp[0] else 0.0
            avg_sold_price = (total_revenue / sold_count) if sold_count > 0 else 0.0
            estimated_inventory_value = inventory_value + (unpriced_available_count * avg_sold_price)
            net_profit = total_revenue - total_expenses
            margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 100.0
            return {
                "total_revenue": total_revenue,
                "total_cost": 0.0,
                "operating_expenses": total_expenses,
                "net_profit": net_profit,
                "profit_margin": round(margin, 1),
                "inventory_value": inventory_value,
                "sold_count": sold_count,
                "available_count": available_count,
                "priced_available_count": priced_available_count,
                "unpriced_available_count": unpriced_available_count,
                "avg_sold_price": round(avg_sold_price, 2),
                "estimated_inventory_value": round(estimated_inventory_value, 2),
            }

        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?select=id,status,costPrice,sellingPriceText,farmedMaps",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code != 200:
                return {}
            items = resp.json()

            total_revenue = 0.0
            total_cost = 0.0
            sold_count = 0
            available_count = 0
            priced_available_count = 0
            unpriced_available_count = 0
            inventory_value = 0.0

            for it in items:
                status = it.get("status")
                cost = float(it.get("costPrice") or 0.0)
                raw_price = it.get("sellingPriceText") or ""
                nums = re.findall(r"[\d.]+", raw_price)
                price = float(nums[0]) if nums else 0.0

                if status == "SOLD":
                    sold_count += 1
                    total_revenue += price
                    total_cost += cost
                elif status == "AVAILABLE":
                    available_count += 1
                    if price > 0:
                        priced_available_count += 1
                        inventory_value += price
                    else:
                        unpriced_available_count += 1

            # Fetch expenses from Supabase
            total_expenses = 0.0
            try:
                resp_exp = requests.get(
                    f"{SUPABASE_URL}/rest/v1/Expense?select=amount",
                    headers=self._supabase_headers,
                    timeout=5
                )
                if resp_exp.status_code == 200:
                    total_expenses = sum(float(e.get("amount") or 0.0) for e in resp_exp.json())
            except Exception:
                pass

            avg_sold_price = (total_revenue / sold_count) if sold_count > 0 else 0.0
            estimated_inventory_value = inventory_value + (unpriced_available_count * avg_sold_price)
            net_profit = total_revenue - total_cost - total_expenses
            margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 100.0

            return {
                "total_revenue": total_revenue,
                "total_cost": total_cost,
                "operating_expenses": total_expenses,
                "net_profit": net_profit,
                "profit_margin": round(margin, 1),
                "inventory_value": inventory_value,
                "sold_count": sold_count,
                "available_count": available_count,
                "priced_available_count": priced_available_count,
                "unpriced_available_count": unpriced_available_count,
                "avg_sold_price": round(avg_sold_price, 2),
                "estimated_inventory_value": round(estimated_inventory_value, 2),
            }
        except Exception as e:
            logger.error("Error getting financial stats: %s", e)
            return {}

    def add_expense(
        self,
        title: str,
        amount: float,
        category: str = "OTHER",
        note: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        if self._is_test_env and getattr(requests.post, "__module__", "") == "requests.api":
            return self._local_add_expense(title, amount, category, note)

        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "id": str(uuid.uuid4()),
            "title": title.strip(),
            "amount": float(amount),
            "category": category.strip().upper(),
            "note": note.strip() if note else None,
            "paidAt": now_iso,
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }
        try:
            resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/Expense",
                headers={**self._supabase_headers, "Prefer": "return=representation"},
                data=json.dumps(payload),
                timeout=5
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                created = data[0] if isinstance(data, list) and len(data) > 0 else payload

                # Auto-broadcast to #web-orders, #web-stock-logs, #kaitun-id
                if not self._is_test_env:
                    try:
                        cat_labels = {
                            "SCRIPT": "ค่าสคริปต์ฟาร์ม 📜",
                            "VPS": "ค่า VPS / เซิร์ฟเวอร์ 💻",
                            "ELECTRICITY": "ค่าไฟ / ค่าฮาร์ดแวร์ ⚡",
                            "BOT_HOST": "ค่าโฮสต์บอท Discord 🤖",
                            "OTHER": "รายจ่ายอื่นๆ 📦",
                        }
                        cat_str = cat_labels.get(payload["category"], payload["category"])
                        embed_notif = {
                            "title": f"💸 [บันทึกค่าใช้จ่ายใหม่] {payload['title']}",
                            "description": "บันทึกค่าใช้จ่ายร้านเข้าระบบบัญชีและหักลบจากกำไรสุทธิเรียบร้อยแล้ว",
                            "color": 0xF59E0B,
                            "fields": [
                                {"name": "รายการค่าใช้จ่าย", "value": f"**{payload['title']}**", "inline": True},
                                {"name": "หมวดหมู่", "value": cat_str, "inline": True},
                                {"name": "จำนวนเงิน", "value": f"**฿{payload['amount']:,.2f}**", "inline": True},
                            ],
                            "footer": {"text": "ซิงค์ระบบบัญชีและแจ้งเตือนทุกระบบพร้อมกัน"},
                        }
                        if payload.get("note"):
                            embed_notif["fields"].append({"name": "หมายเหตุ", "value": f"```{payload['note']}```", "inline": False})

                        self.broadcast_webhooks(["orders", "stocks", "kaitun_sync"], embed_notif)
                    except Exception as e:
                        logger.warning("Failed to broadcast expense webhook: %s", e)

                if self._is_test_env:
                    try:
                        self._local_add_expense(title, amount, category, note)
                    except Exception:
                        pass
                return created
            elif self._is_test_env:
                return self._local_add_expense(title, amount, category, note)
            logger.error("Failed to add expense to Supabase: %s %s", resp.status_code, resp.text)
        except Exception as e:
            if self._is_test_env:
                return self._local_add_expense(title, amount, category, note)
            logger.error("Error adding expense: %s", e)
        return None

    def list_expenses(self, limit: int = 15) -> List[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_list_expenses(limit)

        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/Expense?order=paidAt.desc&limit={limit}&select=*",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.error("Error listing expenses: %s", e)
        return []

    def delete_expense(self, expense_id: str) -> Optional[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_delete_expense(expense_id)

        target = None
        q = (expense_id or "").strip()
        recent = self.list_expenses(limit=30)
        if not recent:
            return None

        if q.lower() in ("latest", "ล่าสุด", "อันล่าสุด", "รายการล่าสุด"):
            target = recent[0]
        else:
            for e in recent:
                if e.get("id") == q or e.get("id", "").startswith(q) or q.lower() in e.get("title", "").lower():
                    target = e
                    break
        if not target:
            target = {"id": q, "title": q, "amount": 0.0}

        real_id = target.get("id")
        try:
            resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/Expense?id=eq.{real_id}",
                headers=self._supabase_headers,
                timeout=5
            )
            ok = resp.status_code in (200, 204)
            if ok:
                try:
                    title_str = target.get("title") or real_id
                    amount_val = float(target.get("amount") or 0.0)
                    embed_del = {
                        "title": f"🗑️ [ลบรายการค่าใช้จ่าย] {title_str}",
                        "description": "ลบรายการค่าใช้จ่ายออกจากระบบบัญชีและคำนวณกำไรสุทธิใหม่เรียบร้อยแล้ว",
                        "color": 0xEF4444,
                        "fields": [
                            {"name": "รายการที่ลบ", "value": f"**{title_str}**", "inline": True},
                            {"name": "จำนวนเงินที่ยกเลิก", "value": f"**฿{amount_val:,.2f}**" if amount_val > 0 else f"`{real_id}`", "inline": True},
                        ],
                        "footer": {"text": "ซิงค์ระบบบัญชีและแจ้งเตือนทุกระบบพร้อมกัน"},
                    }
                    self.broadcast_webhooks(["orders", "stocks", "kaitun_sync"], embed_del)
                except Exception as e:
                    logger.warning("Failed to broadcast delete expense webhook: %s", e)
                return target
            return None
        except Exception as e:
            logger.error("Error deleting expense: %s", e)
            return None

    def cancel_or_undo_sale(self, query: str) -> Optional[Dict[str, Any]]:
        """ยกเลิกการขาย: หากเป็นไอดีในสต็อกจะคืนสถานะเป็น AVAILABLE / หากเป็นไอเทมจะลบรายการออก"""
        q = query.strip()
        if not q:
            return None

        acc = self.get_kaitun_account(q)
        if acc:
            is_item = (
                acc.get("password") == "ITEM_SALE"
                or "ITEM-" in str(acc.get("serialCode") or "")
                or "ITEM-" in str(acc.get("username") or "")
            )
            if is_item:
                if self._is_test_env:
                    with self.connection as conn:
                        conn.execute("DELETE FROM kaitun_accounts WHERE id = ?", (acc["id"],))
                        return {"type": "item_sale_cancelled", "item": acc}
                else:
                    try:
                        requests.delete(
                            f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{acc['id']}",
                            headers=self._supabase_headers,
                            timeout=5,
                        )
                        return {"type": "item_sale_cancelled", "item": acc}
                    except Exception as e:
                        logger.error("Error deleting item sale: %s", e)
            elif acc.get("sale_status") == "sold" or acc.get("status") in ("used", "SOLD"):
                ok = self.update_kaitun_account(acc["username"], sale_status="unsold")
                if ok:
                    return {"type": "account_restored", "account": acc}
            else:
                return {"type": "account_not_sold", "account": acc}

        if self._is_test_env:
            with self.connection as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM kaitun_accounts WHERE username LIKE ? AND sale_status = 'sold' LIMIT 1", (f"%{q}%",))
                row = cur.fetchone()
                if row:
                    cur.execute("DELETE FROM kaitun_accounts WHERE id = ?", (row["id"],))
                    return {"type": "item_sale_cancelled", "item": dict(row)}
        else:
            try:
                resp = requests.get(
                    f"{SUPABASE_URL}/rest/v1/AccountStock?username=ilike.*{q}*&status=eq.SOLD&limit=1&select=*",
                    headers=self._supabase_headers,
                    timeout=5
                )
                if resp.status_code == 200 and resp.json():
                    item = resp.json()[0]
                    if "ITEM-" in item.get("serialCode", "") or "ITEM_SALE" in item.get("credentials", ""):
                        del_resp = requests.delete(
                            f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{item['id']}",
                            headers=self._supabase_headers,
                            timeout=5
                        )
                        if del_resp.status_code in (200, 204):
                            return {"type": "item_sale_cancelled", "item": item}
                    else:
                        ok = self.update_kaitun_account(item.get("username", q), sale_status="unsold")
                        if ok:
                            return {"type": "account_restored", "account": item}
            except Exception as e:
                logger.error("Error cancelling sale: %s", e)
        return None

    def get_webhook_url(self, channel_key: str) -> Optional[str]:
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/WebhookChannelConfig?channelKey=eq.{channel_key}&isActive=eq.true&select=webhookUrl",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows and len(rows) > 0 and rows[0].get("webhookUrl"):
                    return rows[0]["webhookUrl"]
        except Exception as e:
            logger.error("Error fetching webhook URL for %s: %s", channel_key, e)
        return None

    def send_webhook(self, channel_key: str, embed: Dict[str, Any]) -> bool:
        url = self.get_webhook_url(channel_key)
        if not url:
            return False
        payload = {
            "username": "KaiZort System Log",
            "avatar_url": "https://qidraqabrlnuurnlkwko.supabase.co/storage/v1/object/public/assets/kaizort_logo.png",
            "embeds": [
                {
                    **embed,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "footer": embed.get("footer") or {"text": "KaiZort Store • System Notification"},
                }
            ],
        }
        try:
            res = requests.post(url, json=payload, timeout=5)
            return res.status_code in (200, 204)
        except Exception as e:
            logger.error("Error sending webhook to %s: %s", channel_key, e)
            return False

    def broadcast_webhooks(self, channel_keys: List[str], embed: Dict[str, Any]) -> None:
        """ส่ง Webhook แจ้งเตือนพร้อมกันไปยังหลายช่องทางตามที่กำหนด"""
        for key in channel_keys:
            try:
                self.send_webhook(key, embed)
            except Exception as e:
                logger.warning("Failed to broadcast webhook to %s: %s", key, e)

    def add_item_sale(
        self,
        title: str,
        amount: float,
        cost: float = 0.0,
        note: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """บันทึกรายได้จากการขายไอเทม/บริการ (Non-Account Item Sale) และคำนวณเข้าสู่ระบบบัญชีทันที"""
        now_iso = datetime.now(timezone.utc).isoformat()
        item_id = str(uuid.uuid4())
        serial = f"ITEM-{int(datetime.now().timestamp()) % 100000:05d}"

        if self._is_test_env:
            with self.connection as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO kaitun_accounts (username, password, raw_line, status, sale_status, added_by, added_at, price, farmed_maps)
                    VALUES (?, ?, ?, 'used', 'sold', ?, datetime('now'), ?, ?)
                    """,
                    (f"{title.strip()} ({serial})", "ITEM_SALE", title.strip(), user_id or 0, str(amount), title.strip())
                )
                conn.commit()
            return {"id": item_id, "title": title, "amount": amount, "status": "SOLD"}

        product_id = self._get_default_product_id()
        cred_hash = hash_credential(f"item_sale_{item_id}")
        masked_id = mask_identity(title[:10])
        encrypted_cred = encrypt_credential(f"ITEM:{title}:{note or ''}")

        record = {
            "id": item_id,
            "serialCode": serial,
            "productId": product_id,
            "credentialFormat": "USER_PASS",
            "credentialHash": cred_hash,
            "maskedIdentity": masked_id,
            "credentials": encrypted_cred,
            "username": f"{title.strip()} ({serial})",
            "farmedMaps": title.strip(),
            "sellingPriceText": f"{float(amount):.2f}",
            "costPrice": float(cost),
            "details": f"ขายไอเทม/บริการ: {title.strip()}" + (f" • หมายเหตุ: {note.strip()}" if note else ""),
            "status": "SOLD",
            "soldAt": now_iso,
            "addedSource": "DISCORD",
            "addedByDiscordId": str(user_id or 0),
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }

        try:
            resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/AccountStock",
                headers=self._supabase_headers,
                data=json.dumps(record),
                timeout=5,
            )
            if resp.status_code in (200, 201):
                logger.info("Successfully recorded item sale: '%s' for ฿%s", title, amount)

                # Auto-broadcast to #web-orders, #web-stock-logs, #kaitun-id
                try:
                    embed_notif = {
                        "title": f"🎉 [ขายไอเทม/บริการสำเร็จ] {title.strip()}",
                        "description": "บันทึกรายได้จากการขายไอเทมเข้าระบบบัญชีและเพิ่มกำไรสุทธิเรียบร้อยแล้ว",
                        "color": 0x10B981,
                        "fields": [
                            {"name": "📦 รายการสินค้า/ไอเทม", "value": f"**{title.strip()}**", "inline": True},
                            {"name": "💰 ราคาขาย (รายได้)", "value": f"**฿{float(amount):,.2f}**", "inline": True},
                        ],
                        "footer": {"text": "ซิงค์ระบบบัญชี คลังสต็อก และแจ้งเตือนทุกระบบพร้อมกัน"},
                    }
                    if cost > 0:
                        embed_notif["fields"].append({"name": "📦 ต้นทุน", "value": f"฿{float(cost):,.2f}", "inline": True})
                        embed_notif["fields"].append({"name": "📈 กำไร", "value": f"**฿{(float(amount) - float(cost)):,.2f}**", "inline": True})
                    if note:
                        embed_notif["fields"].append({"name": "📝 หมายเหตุ", "value": f"```{note.strip()}```", "inline": False})

                    self.broadcast_webhooks(["orders", "stocks", "kaitun_sync"], embed_notif)
                except Exception as e:
                    logger.warning("Failed to broadcast item sale webhook: %s", e)

                return record
            else:
                logger.error("Failed to add item sale to Supabase: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Error adding item sale: %s", e)
        return None

    def dispense_kaitun(self, count: int, user_id: int) -> List[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_dispense(count, user_id)

        # In production Supabase
        avail = self.list_available_kaitun(limit=count)
        dispensed = []
        now_iso = datetime.now(timezone.utc).isoformat()
        for acc in avail:
            patch_data = {
                "status": "SOLD",
                "soldAt": now_iso,
                "updatedAt": now_iso,
            }
            try:
                requests.patch(
                    f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{acc['id']}",
                    headers=self._supabase_headers,
                    data=json.dumps(patch_data),
                    timeout=5
                )
                dispensed.append(acc)
            except Exception as e:
                logger.error("Failed to dispense account %s: %s", acc["username"], e)

        if dispensed:
            try:
                usernames_str = ", ".join(f"`{a['username']}`" for a in dispensed)
                embed_disp = {
                    "title": f"🎁 [เบิกจ่ายไอดีออกจากสต็อก] จำนวน {len(dispensed)} บัญชี",
                    "description": "ระบบทำการตัดสต็อกไอดีและปรับสถานะเป็นขายแล้ว (SOLD) เรียบร้อยแล้ว",
                    "color": 0xF59E0B,
                    "fields": [
                        {"name": "📦 จำนวนที่เบิก", "value": f"**{len(dispensed)} บัญชี**", "inline": True},
                        {"name": "🏷️ สถานะ", "value": "🔴 **ตัดสต็อกแล้ว (SOLD)**", "inline": True},
                        {"name": "👤 รายชื่อบัญชี", "value": usernames_str[:900], "inline": False},
                    ],
                    "footer": {"text": f"เบิกโดย Discord ID: {user_id} • ซิงค์ทุกระบบพร้อมกัน"},
                }
                self.broadcast_webhooks(["orders", "stocks", "kaitun_sync"], embed_disp)
            except Exception as e:
                logger.warning("Failed to broadcast dispense webhook: %s", e)

        return dispensed

    def list_available_kaitun(self, limit: int = 20) -> List[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_list(sale_status="unsold", limit=limit)

        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?status=eq.AVAILABLE&order=createdAt.desc&limit={limit}&select=*",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code == 200 and resp.json():
                return [self._map_stock_row(r) for r in resp.json()]
        except Exception as e:
            logger.error("Error listing available from Supabase: %s", e)
        return []

    def update_kaitun_account(
        self,
        username: str,
        password: Optional[str] = None,
        farmed_maps: Optional[str] = None,
        details: Optional[str] = None,
        sale_status: Optional[str] = None,
        price: Optional[str] = None,
        actor: Optional[str] = None,
    ) -> bool:
        if self._is_test_env:
            return self._local_update(username, password, farmed_maps, details, sale_status, price)

        acc = self.get_kaitun_account(username)
        if not acc:
            return False

        real_username = acc.get("username") or username.strip()

        patch_data: Dict[str, Any] = {
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }

        if password is not None:
            cred_str = f"{real_username}:{password}"
            if acc.get("cookie"):
                cred_str += f":{acc['cookie']}"
            patch_data["credentials"] = encrypt_credential(cred_str)
        if farmed_maps is not None:
            patch_data["farmedMaps"] = farmed_maps
        if details is not None:
            patch_data["details"] = details
        if sale_status is not None:
            if sale_status == "sold":
                patch_data["status"] = "SOLD"
                patch_data["soldAt"] = datetime.now(timezone.utc).isoformat()
            elif sale_status == "unsold":
                patch_data["status"] = "AVAILABLE"
                patch_data["soldAt"] = None
        if price is not None:
            patch_data["sellingPriceText"] = price

        try:
            resp = requests.patch(
                f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{acc['id']}",
                headers=self._supabase_headers,
                data=json.dumps(patch_data),
                timeout=5
            )
            success = resp.status_code in (200, 204)
            if success:
                try:
                    self._local_update(real_username, password, farmed_maps, details, sale_status, price)
                except Exception:
                    pass

                # Webhook Notifications
                final_maps = farmed_maps if farmed_maps is not None else acc.get("farmed_maps", "")
                final_details = details if details is not None else acc.get("details", "")
                raw_price = price if price is not None else acc.get("price", "")
                price_str = str(raw_price).strip() if raw_price is not None else ""
                price_display = f"฿{price_str}" if price_str and not price_str.startswith("฿") and not "บาท" in price_str else (price_str or "ไม่ระบุ")

                effective_status = sale_status if sale_status is not None else acc.get("sale_status")
                is_sold = (effective_status == "sold")

                if is_sold:
                    # 1. Broadcast sale to #web-orders
                    try:
                        embed_order = {
                            "title": f"🎉 [ขายไอดีสำเร็จ] {real_username}",
                            "description": "บันทึกการขายไอดีไก่ตันออกจากคลังสต็อก และคำนวณเข้าสู่ระบบบัญชีเรียบร้อยแล้ว",
                            "color": 0x10B981,
                            "fields": [
                                {"name": "👤 บัญชี (Username)", "value": f"**{real_username}**", "inline": True},
                                {"name": "💰 ราคาขาย (รายได้)", "value": f"**{price_display}**", "inline": True},
                                {"name": "🏷️ สถานะ", "value": "🔴 **ขายแล้ว (Sold)**", "inline": True},
                            ],
                            "footer": {"text": f"ดำเนินการโดย {actor or 'Staff'} • ซิงค์กับระบบบัญชีและ #web-orders ทันที"},
                        }
                        if final_maps:
                            embed_order["fields"].append({"name": "🗺️ แมพที่ฟาร์ม", "value": f"`{final_maps}`", "inline": True})
                        if final_details:
                            embed_order["fields"].append({"name": "📝 รายละเอียดของในไอดี", "value": f"```{final_details[:300]}```", "inline": False})

                        self.send_webhook("orders", embed_order)
                    except Exception as e:
                        logger.warning("Failed to broadcast order webhook: %s", e)

                    # 2. Broadcast sold audit to #web-stock-logs and #kaitun-id
                    try:
                        embed_stock = {
                            "title": f"📦 [อัปเดตสต็อกไอดี: ขายแล้ว] {real_username}",
                            "description": "บันทึกสถานะไอดีเป็น 'ขายแล้ว (Sold)' และตัดออกจากสต็อกพร้อมขาย",
                            "color": 0xEF4444,
                            "fields": [
                                {"name": "👤 บัญชี", "value": f"`{real_username}`", "inline": True},
                                {"name": "🏷️ สถานะการขาย", "value": "🔴 **ขายแล้ว (Sold)**", "inline": True},
                                {"name": "💰 ราคา", "value": f"`{price_display}`", "inline": True},
                            ],
                            "footer": {"text": f"อัปเดตโดย {actor or 'Staff'} • ซิงค์ทุกระบบพร้อมกัน"},
                        }
                        if final_maps:
                            embed_stock["fields"].append({"name": "🗺️ แมพ", "value": f"`{final_maps}`", "inline": True})
                        if final_details:
                            embed_stock["fields"].append({"name": "📝 รายละเอียด", "value": f"```{final_details[:300]}```", "inline": False})

                        self.broadcast_webhooks(["stocks", "kaitun_sync"], embed_stock)
                    except Exception as e:
                        logger.warning("Failed to broadcast stock sold webhook: %s", e)

                else:
                    # Broadcast normal stock update audit to #web-stock-logs and #kaitun-id
                    try:
                        embed_stock = {
                            "title": f"📦 [อัปเดตข้อมูลไอดี] {real_username}",
                            "description": "มีการแก้ไขข้อมูลไอดีในคลังสต็อก",
                            "color": 0x3B82F6,
                            "fields": [
                                {"name": "👤 บัญชี", "value": f"`{real_username}`", "inline": True},
                                {"name": "🏷️ สถานะการขาย", "value": "🟢 **พร้อมขาย (Available)**", "inline": True},
                            ],
                            "footer": {"text": f"อัปเดตโดย {actor or 'Staff'} • ซิงค์ทุกระบบพร้อมกัน"},
                        }
                        if price_display and price_display != "ไม่ระบุ":
                            embed_stock["fields"].append({"name": "💰 ราคา", "value": f"`{price_display}`", "inline": True})
                        if final_maps:
                            embed_stock["fields"].append({"name": "🗺️ แมพ", "value": f"`{final_maps}`", "inline": True})
                        if final_details:
                            embed_stock["fields"].append({"name": "📝 รายละเอียด", "value": f"```{final_details[:300]}```", "inline": False})

                        self.broadcast_webhooks(["stocks", "kaitun_sync"], embed_stock)
                    except Exception as e:
                        logger.warning("Failed to broadcast stock update webhook: %s", e)

            return success
        except Exception as e:
            logger.error("Error updating account on Supabase: %s", e)
            return False

    def list_kaitun_accounts(
        self,
        sale_status: Optional[str] = None,
        map_query: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_list(sale_status, map_query, limit)

        query_params = [f"order=createdAt.desc", f"limit={limit}"]
        if sale_status:
            target_status = "SOLD" if sale_status == "sold" else "AVAILABLE"
            query_params.append(f"status=eq.{target_status}")
        if map_query:
            query_params.append(f"farmedMaps=ilike.*{map_query}*")

        try:
            url = f"{SUPABASE_URL}/rest/v1/AccountStock?{'&'.join(query_params)}&select=*"
            resp = requests.get(url, headers=self._supabase_headers, timeout=5)
            if resp.status_code == 200 and resp.json():
                return [self._map_stock_row(r) for r in resp.json()]
        except Exception as e:
            logger.error("Error listing accounts from Supabase: %s", e)
        return []

    def delete_kaitun_account(self, username: str) -> bool:
        if self._is_test_env:
            with self.connection as conn:
                cur = conn.cursor()
                cur.execute("DELETE FROM kaitun_accounts WHERE username = ? COLLATE NOCASE", (username.strip(),))
                conn.commit()
                return cur.rowcount > 0

        acc = self.get_kaitun_account(username)
        if not acc:
            return False

        try:
            resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/AccountStock?id=eq.{acc['id']}",
                headers=self._supabase_headers,
                timeout=5
            )
            ok = resp.status_code in (200, 204)
            if ok:
                try:
                    embed_del = {
                        "title": f"🗑️ [นำไอดีออกจากคลังสต็อก] {username}",
                        "description": "ลบบัญชีออกจากฐานข้อมูลคลังสต็อกเรียบร้อยแล้ว",
                        "color": 0xEF4444,
                        "fields": [
                            {"name": "👤 บัญชี (Username)", "value": f"`{username}`", "inline": True},
                            {"name": "🔖 รหัสอ้างอิง", "value": f"`{acc.get('serialCode') or acc.get('id', '-')}`", "inline": True},
                        ],
                        "footer": {"text": "ซิงค์คลังสต็อกและแจ้งเตือนทุกระบบพร้อมกัน"},
                    }
                    self.broadcast_webhooks(["stocks", "kaitun_sync"], embed_del)
                except Exception as e:
                    logger.warning("Failed to broadcast delete stock webhook: %s", e)
            return ok
        except Exception as e:
            logger.error("Error deleting account from Supabase: %s", e)
            return False

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None
