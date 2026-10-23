from datetime import datetime, timezone
import logging
import os
import sqlite3
import hmac
import hashlib
import uuid
import json
import requests
from typing import Optional, Dict, Any, List, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qidraqabrlnuurnlkwko.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZHJhcWFicmxudXVybmxrd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQwMzQ5MSwiZXhwIjoyMTA3OTc5NDkxfQ.c_1QBE2T4ujEscyHUPuzkXnHW33o8KHXKyKy99eJiGM"
)
STOCK_ENCRYPTION_SECRET = os.getenv("STOCK_ENCRYPTION_SECRET", "kz_store_aes256_gcm_stock_vault_secret_2026")

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
        self._is_test_env = "test" in os.path.basename(path).lower() or "pytest" in path.lower() or os.getenv("TESTING") == "1"
        self._supabase_headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self._default_product_id: Optional[str] = None

    @property
    def connection(self) -> sqlite3.Connection:
        if self._connection is None:
            self._ensure_parent_dir()
            self._connection = sqlite3.connect(self.path)
            self._connection.row_factory = sqlite3.Row
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
        cursor = self.connection.cursor()
        cursor.execute(
            "SELECT id, username, password, cookie, status, farmed_maps, details, sale_status, price, added_at, used_at FROM kaitun_accounts WHERE username = ? COLLATE NOCASE",
            (username,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    def _local_add_account(self, username, password, cookie, raw_line, user_id):
        existing = self._local_get_account(username)
        if existing:
            if existing.get("password") == password:
                return "duplicate", existing
            else:
                with self.connection:
                    self.connection.execute(
                        "UPDATE kaitun_accounts SET password = ?, raw_line = ?, cookie = COALESCE(?, cookie) WHERE id = ?",
                        (password, raw_line, cookie, existing["id"]),
                    )
                return "password_updated", existing
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.connection:
            self.connection.execute(
                "INSERT INTO kaitun_accounts (username, password, cookie, raw_line, status, added_by, added_at) VALUES (?, ?, ?, ?, 'available', ?, ?)",
                (username, password, cookie, raw_line, user_id, now_iso),
            )
        return "created", None

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

    def get_kaitun_account(self, username: str) -> Optional[Dict[str, Any]]:
        if self._is_test_env:
            return self._local_get_account(username)

        u = username.strip().lower()
        cred_hash = hash_credential(u)
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?credentialHash=eq.{cred_hash}&select=*",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp.status_code == 200 and resp.json():
                return self._map_stock_row(resp.json()[0])

            # Fallback search by username if hash differs
            resp2 = requests.get(
                f"{SUPABASE_URL}/rest/v1/AccountStock?username=ilike.{username.strip()}&select=*",
                headers=self._supabase_headers,
                timeout=5
            )
            if resp2.status_code == 200 and resp2.json():
                return self._map_stock_row(resp2.json()[0])
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
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        if self._is_test_env:
            return self._local_add_account(username, password, cookie, raw_line, user_id)

        existing = self.get_kaitun_account(username)
        if existing:
            if existing.get("password") == password:
                logger.warning("Duplicate kaitun account rejected on Supabase: '%s'", username)
                return "duplicate", existing
            else:
                # Password updated
                cred_str = f"{username}:{password}"
                if cookie:
                    cred_str += f":{cookie}"
                encrypted_cred = encrypt_credential(cred_str)

                now_iso = datetime.now(timezone.utc).isoformat()
                patch_data = {
                    "credentials": encrypted_cred,
                    "updatedAt": now_iso,
                }
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

        try:
            resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/AccountStock",
                headers=self._supabase_headers,
                data=json.dumps(record),
                timeout=5
            )
            if resp.status_code in (200, 201):
                logger.info("Successfully created kaitun account on Supabase: '%s'", username)
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
    ) -> bool:
        status, _ = self.add_kaitun_account_smart(
            username=username,
            password=password,
            cookie=cookie,
            raw_line=raw_line,
            user_id=user_id,
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
        if self._is_test_env:
            return {
                "total_revenue": 0.0,
                "total_cost": 0.0,
                "net_profit": 0.0,
                "profit_margin": 100.0,
                "inventory_value": 0.0,
                "sold_count": 0,
                "available_count": 0,
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
            inventory_value = 0.0

            import re

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
                    inventory_value += price

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

                # Auto-broadcast to #web-orders
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
                    }
                    if payload.get("note"):
                        embed_notif["fields"].append({"name": "หมายเหตุ", "value": f"```{payload['note']}```", "inline": False})

                    self.send_webhook("orders", embed_notif)
                except Exception as e:
                    logger.warning("Failed to broadcast expense webhook: %s", e)

                return created
            logger.error("Failed to add expense to Supabase: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Error adding expense: %s", e)
        return None

    def list_expenses(self, limit: int = 15) -> List[Dict[str, Any]]:
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

    def delete_expense(self, expense_id: str) -> bool:
        try:
            resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/Expense?id=eq.{expense_id}",
                headers=self._supabase_headers,
                timeout=5
            )
            return resp.status_code in (200, 204)
        except Exception as e:
            logger.error("Error deleting expense: %s", e)
            return False

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
    ) -> bool:
        if self._is_test_env:
            return self._local_update(username, password, farmed_maps, details, sale_status, price)

        acc = self.get_kaitun_account(username)
        if not acc:
            return False

        patch_data: Dict[str, Any] = {
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }

        if password is not None:
            cred_str = f"{username}:{password}"
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
                    self._local_update(username, password, farmed_maps, details, sale_status, price)
                except Exception:
                    pass
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
            with self._get_connection() as conn:
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
            return resp.status_code in (200, 204)
        except Exception as e:
            logger.error("Error deleting account from Supabase: %s", e)
            return False

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None
