from dataclasses import dataclass
import hashlib
import re
import secrets
import string
from typing import Optional, Tuple
from database import Database

HEX_DIGITS = set(string.hexdigits)


def normalize_key(raw_key: str) -> str:
    return raw_key.strip() if raw_key else ""


def extract_key(raw_input: str, prefix: str = "FREE_", hex_length: int = 32) -> str:
    if not raw_input:
        return ""
    cleaned = raw_input.strip()
    pattern = rf"{re.escape(prefix)}[0-9a-fA-F]{{{hex_length}}}"
    match = re.search(pattern, cleaned)
    if match:
        return match.group(0)
    return cleaned


def is_valid_key(raw_key: str, prefix: str = "FREE_", hex_length: int = 32) -> bool:
    normalized = normalize_key(raw_key)
    if not normalized.startswith(prefix):
        return False

    suffix = normalized[len(prefix):]
    if len(suffix) != hex_length:
        return False

    return all(c in HEX_DIGITS for c in suffix)


def hash_key(key: str) -> str:
    normalized = normalize_key(key)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class RedeemResult:
    ok: bool
    code: str
    message: str
    extracted_key: Optional[str] = None


class KeyService:
    def __init__(self, database: Database, prefix: str = "FREE_", hex_length: int = 32):
        self.database = database
        self.prefix = prefix
        self.hex_length = hex_length

    def is_valid_key(self, raw_key: str) -> bool:
        return is_valid_key(raw_key, self.prefix, self.hex_length)

    def generate_key(self, user_id: int) -> Tuple[bool, str]:
        raw_hex = secrets.token_hex(self.hex_length // 2)
        new_key = f"{self.prefix}{raw_hex}"
        key_hashed = hash_key(new_key)
        self.database.insert_key(key_hashed, user_id)
        return True, new_key

    def redeem(self, raw_input: str, user_id: int) -> RedeemResult:
        key = extract_key(raw_input, self.prefix, self.hex_length)
        if not self.is_valid_key(key):
            return RedeemResult(
                ok=False,
                code="invalid_format",
                message="รูปแบบคีย์ไม่ถูกต้อง กรุณาตรวจสอบคีย์หรือลิงก์ที่กรอก",
                extracted_key=None,
            )

        key_hashed = hash_key(key)
        inserted = self.database.insert_key(key_hashed, user_id)
        if not inserted:
            return RedeemResult(
                ok=False,
                code="already_redeemed",
                message="คีย์นี้ถูกใช้งานไปแล้ว ไม่สามารถใช้งานซ้ำได้",
                extracted_key=key,
            )

        return RedeemResult(
            ok=True,
            code="redeemed",
            message="ยืนยันและเปิดใช้งานคีย์สำเร็จ!",
            extracted_key=key,
        )
