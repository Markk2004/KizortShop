from dataclasses import dataclass
import logging
from typing import Optional
from key_service import KeyService
from provider_client import ProviderClient

logger = logging.getLogger(__name__)

ERROR_MESSAGES = {
    "provider_not_configured": "ระบบยังไม่ได้เปิดใช้งานหรือตั้งค่า Provider ภายนอกที่ได้รับอนุญาต",
    "invalid_scheme": "ลิงก์ต้องขึ้นต้นด้วย https:// เท่านั้น",
    "host_not_allowed": "โฮสต์ของลิงก์นี้ไม่อยู่ใน Allowlist ที่ได้รับอนุญาต",
    "unauthorized_service": "บริการนี้ไม่อยู่ในรายการที่รองรับและไม่อนุญาตให้เข้าถึง",
    "invalid_key_from_provider": "คีย์ที่ได้รับจาก Provider มีรูปแบบไม่ถูกต้อง",
    "network_error": "ไม่สามารถเชื่อมต่อกับ Provider ได้ กรุณาลองใหม่อีกครั้ง",
}


@dataclass(frozen=True)
class ProcessResult:
    ok: bool
    code: str
    provider: str
    key: Optional[str]
    elapsed_seconds: float
    message: str


class ProcessService:
    def __init__(self, provider_client: ProviderClient, key_service: KeyService):
        self.provider_client = provider_client
        self.key_service = key_service

    def process(self, url: str, user_id: int) -> ProcessResult:
        res = self.provider_client.process_link(url)
        if not res.ok:
            code = res.error_code or "provider_error"
            msg = ERROR_MESSAGES.get(code, f"เกิดข้อผิดพลาดจาก Provider: {code}")
            return ProcessResult(
                ok=False,
                code=code,
                provider=res.provider,
                key=None,
                elapsed_seconds=res.elapsed_seconds,
                message=msg,
            )

        key = res.key
        if not key or not self.key_service.is_valid_key(key):
            return ProcessResult(
                ok=False,
                code="invalid_key_from_provider",
                provider=res.provider,
                key=None,
                elapsed_seconds=res.elapsed_seconds,
                message=ERROR_MESSAGES["invalid_key_from_provider"],
            )

        redeem_res = self.key_service.redeem(key, user_id)
        if not redeem_res.ok:
            return ProcessResult(
                ok=False,
                code=redeem_res.code,
                provider=res.provider,
                key=key,
                elapsed_seconds=res.elapsed_seconds,
                message=redeem_res.message,
            )

        return ProcessResult(
            ok=True,
            code="success",
            provider=res.provider,
            key=key,
            elapsed_seconds=res.elapsed_seconds,
            message="ประมวลผลและเปิดใช้งานคีย์สำเร็จ!",
        )
