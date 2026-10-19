import os
import pytest
from ticket_service import TicketService


def test_ticket_service_lifecycle(tmp_path):
    db_file = str(tmp_path / "test_tickets.sqlite3")
    service = TicketService(db_file)

    # 1. Next number
    assert service.get_next_ticket_number() == 1

    # 2. Create ticket
    t = service.create_ticket(
        ticket_id="TICKET-001",
        channel_id="123456789",
        guild_id="987654321",
        user_id="111222333",
        user_name="customer_john",
        category="claim",
        subject="เคลมไอดีเข้าไม่ได้",
        detail="รหัสผ่านขึ้นว่า incorrect password",
        order_id="ORD-9999",
    )
    assert t["ticket_id"] == "TICKET-001"
    assert t["status"] == "OPEN"

    # 3. Next number after 1
    assert service.get_next_ticket_number() == 2

    # 4. Active ticket lookup
    active = service.get_active_ticket_by_user("111222333", "987654321")
    assert active is not None
    assert active["ticket_id"] == "TICKET-001"
    assert active["order_id"] == "ORD-9999"

    # 5. Channel lookup
    ch_ticket = service.get_ticket_by_channel("123456789")
    assert ch_ticket is not None
    assert ch_ticket["ticket_id"] == "TICKET-001"

    # 6. Transcript generation
    class MockAuthor:
        name = "customer_john"
        id = 111222333

    class MockMessage:
        author = MockAuthor()
        created_at = None
        clean_content = "สวัสดีครับ รหัสไอดีเข้าไม่ได้ครับ"
        attachments = []

    transcript = TicketService.generate_transcript_text(t, [MockMessage()])
    assert "TICKET-001" in transcript
    assert "customer_john" in transcript
    assert "สวัสดีครับ รหัสไอดีเข้าไม่ได้ครับ" in transcript

    # 7. Close ticket
    closed = service.close_ticket("TICKET-001", closed_by="admin_staff", reason="เปลี่ยนไอดีใหม่ให้แล้ว")
    assert closed is True

    # 8. Check active ticket is now None
    active_after = service.get_active_ticket_by_user("111222333", "987654321")
    assert active_after is None
