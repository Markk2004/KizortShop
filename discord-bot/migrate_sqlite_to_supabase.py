import os
import sqlite3
import hmac
import hashlib
import json
import base64
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qidraqabrlnuurnlkwko.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZHJhcWFicmxudXVybmxrd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQwMzQ5MSwiZXhwIjoyMTA3OTc5NDkxfQ.c_1QBE2T4ujEscyHUPuzkXnHW33o8KHXKyKy99eJiGM"
)
STOCK_ENCRYPTION_SECRET = os.getenv("STOCK_ENCRYPTION_SECRET", "kz_store_aes256_gcm_stock_vault_secret_2026")

def get_aes_key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode('utf-8')).digest()

def encrypt_credential(plain_text: str, secret: str) -> str:
    key = get_aes_key(secret)
    aesgcm = AESGCM(key)
    iv = os.urandom(12)
    ct_with_tag = aesgcm.encrypt(iv, plain_text.encode('utf-8'), None)
    ciphertext = ct_with_tag[:-16]
    tag = ct_with_tag[-16:]
    return f"{iv.hex()}:{tag.hex()}:{ciphertext.hex()}"

def hash_credential(username: str, secret: str) -> str:
    return hmac.new(secret.encode('utf-8'), username.strip().lower().encode('utf-8'), hashlib.sha256).hexdigest()

def mask_identity(username: str) -> str:
    u = username.strip().lower()
    if len(u) <= 4:
        return f"{u[:2]}***"
    return f"{u[:4]}***"

import uuid

def main():
    print("Starting migration from SQLite to Supabase AccountStock...")
    sqlite_path = os.path.join(os.path.dirname(__file__), "data", "bot.sqlite3")
    if not os.path.exists(sqlite_path):
        print(f"SQLite file not found at {sqlite_path}")
        return

    # Find KAITUN-VAULT-POOL product in Supabase
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/Product?code=eq.KAITUN-VAULT-POOL&select=id,code",
        headers=headers
    )
    if resp.status_code != 200 or not resp.json():
        print(f"Failed to find KAITUN-VAULT-POOL product: {resp.text}")
        return

    vault_product = resp.json()[0]
    product_id = vault_product["id"]
    print(f"Target Product ID: {product_id} ({vault_product['code']})")

    # Read SQLite rows
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM kaitun_accounts ORDER BY id ASC").fetchall()
    print(f"Found {len(rows)} accounts in SQLite")

    migrated_count = 0
    for r in rows:
        username = r["username"].strip()
        password = r["password"].strip()
        cookie = r["cookie"]
        raw_cred = f"{username}:{password}"
        if cookie:
            raw_cred += f":{cookie}"

        cred_hash = hash_credential(username, STOCK_ENCRYPTION_SECRET)
        masked_id = mask_identity(username)
        encrypted_cred = encrypt_credential(raw_cred, STOCK_ENCRYPTION_SECRET)

        status = "SOLD" if (r["sale_status"] == "sold" or r["status"] == "used") else "AVAILABLE"
        serial = f"STK-DISC-{r['id']:04d}-{username[:6].upper()}"
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()

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
            "sellingPriceText": r["price"] or None,
            "addedSource": "DISCORD",
            "addedByDiscordId": str(r["added_by"]) if r["added_by"] else None,
            "farmedMaps": r["farmed_maps"] or None,
            "details": r["details"] or None,
            "batchCode": "SQLITE-MIGRATED",
            "supplierName": "DISCORD_BOT",
            "status": status,
            "createdAt": now_iso,
            "updatedAt": now_iso,
        }

        # Upsert via REST (on conflict credentialHash)
        upsert_headers = {
            **headers,
            "Prefer": "resolution=merge-duplicates,return=representation"
        }
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/AccountStock?on_conflict=credentialHash",
            headers=upsert_headers,
            data=json.dumps(record)
        )
        if res.status_code in (200, 201):
            migrated_count += 1
            print(f"Migrated: {username} -> {status} (serial: {serial})")
        else:
            print(f"Error migrating {username}: {res.status_code} - {res.text}")

    print(f"Migration finished: Successfully migrated {migrated_count}/{len(rows)} accounts to Supabase.")

if __name__ == "__main__":
    main()
