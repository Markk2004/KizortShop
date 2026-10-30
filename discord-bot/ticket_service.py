import os
import sqlite3
import logging
import json
import requests
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class TicketService:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_parent_dir()
        self.initialize()

    def _ensure_parent_dir(self) -> None:
        directory = os.path.dirname(self.db_path)
        if directory:
            os.makedirs(directory, exist_ok=True)

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def initialize(self) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS discord_tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT UNIQUE NOT NULL,
                    channel_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    user_name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    order_id TEXT,
                    subject TEXT NOT NULL,
                    detail TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'OPEN',
                    created_at TEXT NOT NULL,
                    closed_at TEXT,
                    closed_by TEXT,
                    close_reason TEXT
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tickets_user_status 
                ON discord_tickets (user_id, status);
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tickets_channel 
                ON discord_tickets (channel_id);
                """
            )

    def get_next_ticket_number(self) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM discord_tickets")
            count = cursor.fetchone()[0]
            return count + 1

    def create_ticket(
        self,
        ticket_id: str,
        channel_id: str,
        guild_id: str,
        user_id: str,
        user_name: str,
        category: str,
        subject: str,
        detail: str,
        order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO discord_tickets (
                    ticket_id, channel_id, guild_id, user_id, user_name,
                    category, order_id, subject, detail, status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
                """,
                (
                    ticket_id,
                    str(channel_id),
                    str(guild_id),
                    str(user_id),
                    user_name,
                    category,
                    order_id,
                    subject,
                    detail,
                    now_iso,
                ),
            )
        res = {
            "ticket_id": ticket_id,
            "channel_id": str(channel_id),
            "guild_id": str(guild_id),
            "user_id": str(user_id),
            "user_name": user_name,
            "category": category,
            "order_id": order_id,
            "subject": subject,
            "detail": detail,
            "status": "OPEN",
            "created_at": now_iso,
        }

        # Supabase 2-Way Sync
        is_test = ":memory:" in self.db_path or "test" in os.path.basename(self.db_path).lower() or "pytest" in self.db_path.lower()
        if not is_test:
            try:
                supabase_url = os.getenv("SUPABASE_URL", "https://qidraqabrlnuurnlkwko.supabase.co")
                supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                if supabase_url and supabase_key:
                    headers = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "id": ticket_id,
                        "userId": str(user_id),
                        "orderId": order_id if order_id else None,
                        "subject": subject,
                        "detail": detail,
                        "status": "OPEN",
                        "createdAt": now_iso,
                        "updatedAt": now_iso,
                    }
                    requests.post(
                        f"{supabase_url}/rest/v1/Ticket",
                        headers=headers,
                        data=json.dumps(payload),
                        timeout=5,
                    )
            except Exception as e:
                logger.warning("Failed to sync created ticket to Supabase: %s", e)

        return res

    def get_active_ticket_by_user(
        self, user_id: str, guild_id: str
    ) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM discord_tickets
                WHERE user_id = ? AND guild_id = ? AND status = 'OPEN'
                ORDER BY id DESC LIMIT 1
                """,
                (str(user_id), str(guild_id)),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            return dict(row)

    def get_ticket_by_channel(self, channel_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM discord_tickets WHERE channel_id = ? LIMIT 1",
                (str(channel_id),),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            return dict(row)

    def close_ticket(
        self, ticket_id: str, closed_by: str, reason: str = "แก้ไขปัญหาเรียบร้อย"
    ) -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE discord_tickets
                SET status = 'CLOSED', closed_at = ?, closed_by = ?, close_reason = ?
                WHERE ticket_id = ? AND status = 'OPEN'
                """,
                (now_iso, closed_by, reason, ticket_id),
            )
            updated = cursor.rowcount > 0

        if updated:
            is_test = ":memory:" in self.db_path or "test" in os.path.basename(self.db_path).lower() or "pytest" in self.db_path.lower()
            if not is_test:
                # Supabase 2-Way Sync
                try:
                    supabase_url = os.getenv("SUPABASE_URL", "https://qidraqabrlnuurnlkwko.supabase.co")
                    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                    if supabase_url and supabase_key:
                        headers = {
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}",
                            "Content-Type": "application/json",
                        }
                        patch_data = {
                            "status": "CLOSED",
                            "updatedAt": now_iso,
                        }
                        requests.patch(
                            f"{supabase_url}/rest/v1/Ticket?id=eq.{ticket_id}",
                            headers=headers,
                            data=json.dumps(patch_data),
                            timeout=5,
                        )
                except Exception as e:
                    logger.warning("Failed to sync closed ticket to Supabase: %s", e)

        return updated

    @staticmethod
    def generate_transcript_text(
        ticket_info: Dict[str, Any], messages: List[Any]
    ) -> str:
        lines = [
            "=" * 70,
            f"KAIZORT STORE - TICKET TRANSCRIPT LOG",
            f"Ticket ID: {ticket_info.get('ticket_id', 'N/A')}",
            f"Subject: {ticket_info.get('subject', 'N/A')}",
            f"Category: {ticket_info.get('category', 'N/A')}",
            f"User: {ticket_info.get('user_name', 'N/A')} (ID: {ticket_info.get('user_id', 'N/A')})",
            f"Order ID: {ticket_info.get('order_id') or 'N/A'}",
            f"Created At: {ticket_info.get('created_at', 'N/A')}",
            "=" * 70,
            "",
            "[MESSAGE HISTORY]",
            "-" * 70,
        ]

        for msg in messages:
            author_name = getattr(msg.author, "name", "Unknown")
            author_id = getattr(msg.author, "id", "")
            msg_dt = getattr(msg, "created_at", None) or datetime.now()
            ts = msg_dt.strftime("%Y-%m-%d %H:%M:%S")
            content = getattr(msg, "clean_content", "") or getattr(msg, "content", "")

            # Include attachment filenames if present
            attachments = getattr(msg, "attachments", [])
            att_info = ""
            if attachments:
                att_info = " [Attachments: " + ", ".join([a.filename for a in attachments]) + "]"

            lines.append(f"[{ts}] {author_name} ({author_id}): {content}{att_info}")

        lines.extend(["", "-" * 70, f"End of Transcript | Logged at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
        return "\n".join(lines)
