"""
Antigravity (agy) CLI bridge for Discord.
รับคำสั่งทั่วไปจาก Discord แล้วส่งต่อให้ agy CLI (print mode) แบบอ่านอย่างเดียว
"""

import asyncio
import json
import logging
import os
import shutil
from dataclasses import dataclass, field
from typing import List, Optional, Set

logger = logging.getLogger(__name__)

DISCORD_MESSAGE_LIMIT = 1900


@dataclass(frozen=True)
class AgySettings:
    enabled: bool = False
    allowed_user_ids: Set[int] = field(default_factory=set)
    channel_id: Optional[int] = None
    timeout_seconds: int = 120
    model: str = ""
    workdir: str = ""
    agy_path: str = ""


def _parse_id_set(raw: str) -> Set[int]:
    ids: Set[int] = set()
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit():
            ids.add(int(part))
    return ids


def load_agy_settings() -> AgySettings:
    raw_channel = os.getenv("AGY_CHANNEL_ID", "").strip()
    raw_timeout = os.getenv("AGY_TIMEOUT_SECONDS", "120").strip()
    try:
        timeout = max(10, min(300, int(raw_timeout)))
    except ValueError:
        timeout = 120
    return AgySettings(
        enabled=os.getenv("AGY_ENABLED", "false").strip().lower() in ("true", "1", "yes"),
        allowed_user_ids=_parse_id_set(os.getenv("AGY_ALLOWED_USER_IDS", "")),
        channel_id=int(raw_channel) if raw_channel.isdigit() else None,
        timeout_seconds=timeout,
        model=os.getenv("AGY_MODEL", "").strip(),
        workdir=os.getenv("AGY_WORKDIR", "").strip(),
        agy_path=os.getenv("AGY_PATH", "").strip(),
    )


def split_for_discord(text: str, limit: int = DISCORD_MESSAGE_LIMIT) -> List[str]:
    """แบ่งข้อความยาวเป็นหลายส่วนไม่เกินลิมิตของ Discord"""
    text = (text or "").strip()
    if not text:
        return ["(ไม่มีข้อความตอบกลับ)"]
    chunks: List[str] = []
    while len(text) > limit:
        cut = text.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = limit
        chunks.append(text[:cut].rstrip())
        text = text[cut:].lstrip("\n")
    if text:
        chunks.append(text)
    return chunks


def extract_response_text(stdout: str) -> str:
    """ดึงข้อความตอบกลับจากผลลัพธ์ JSON ของ agy ถ้า parse ไม่ได้ให้คืนข้อความดิบ"""
    stdout = (stdout or "").strip()
    if not stdout:
        return ""
    try:
        data = json.loads(stdout)
    except (ValueError, TypeError):
        return stdout
    if isinstance(data, dict):
        for key in ("response", "result", "text", "output", "content"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return stdout


class AgyService:
    """รันคำสั่ง agy ทีละงาน (Lock) แบบอ่านอย่างเดียว ไม่บล็อก event loop"""

    def __init__(self, settings: AgySettings):
        self.settings = settings
        self._lock = asyncio.Lock()

    def is_user_allowed(self, user_id: int) -> bool:
        return user_id in self.settings.allowed_user_ids

    def is_channel_allowed(self, channel_id: Optional[int]) -> bool:
        if self.settings.channel_id is None:
            return True
        return channel_id == self.settings.channel_id

    def resolve_binary(self) -> Optional[str]:
        if self.settings.agy_path and os.path.exists(self.settings.agy_path):
            return self.settings.agy_path
        return shutil.which("agy")

    def build_command(self, binary: str, prompt: str) -> List[str]:
        cmd = [
            binary,
            "--print",
            prompt,
            "--output-format",
            "json",
            "--mode",
            "plan",
            "--sandbox",
            "--effort",
            "low",
        ]
        if self.settings.model:
            cmd += ["--model", self.settings.model]
        return cmd

    async def run(self, prompt: str) -> str:
        if not self.settings.enabled:
            return "ระบบ agy ถูกปิดอยู่ (ตั้ง AGY_ENABLED=true ใน .env เพื่อเปิดใช้งาน)"
        binary = self.resolve_binary()
        if not binary:
            return "ไม่พบโปรแกรม agy ในเครื่อง (ตั้งค่า AGY_PATH ใน .env)"
        prompt = (prompt or "").strip()
        if not prompt:
            return "กรุณาระบุคำสั่งหรือคำถาม"

        async with self._lock:
            cmd = self.build_command(binary, prompt)
            cwd = self.settings.workdir if self.settings.workdir and os.path.isdir(self.settings.workdir) else None
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdin=asyncio.subprocess.DEVNULL,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=cwd,
                )
                try:
                    out, err = await asyncio.wait_for(
                        proc.communicate(), timeout=self.settings.timeout_seconds
                    )
                except asyncio.TimeoutError:
                    proc.kill()
                    await proc.wait()
                    return f"agy ใช้เวลาเกิน {self.settings.timeout_seconds} วินาที ยกเลิกงานแล้ว"
            except Exception as e:
                logger.error("Failed to run agy: %s", e)
                return f"เรียก agy ไม่สำเร็จ: {e}"

            text = extract_response_text(out.decode("utf-8", errors="replace"))
            if proc.returncode != 0 and not text:
                err_text = err.decode("utf-8", errors="replace").strip()
                return f"agy จบการทำงานด้วยข้อผิดพลาด (code {proc.returncode}): {err_text[:500]}"
            return text or "(ไม่มีข้อความตอบกลับ)"
