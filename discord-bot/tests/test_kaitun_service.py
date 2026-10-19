import pytest
from database import Database
from kaitun_service import (
    generate_secure_password,
    generate_roblox_username,
    parse_account_line,
    KaitunService,
)


def test_password_generation():
    p1 = generate_secure_password(14)
    p2 = generate_secure_password(14)
    assert len(p1) == 14
    assert len(p2) == 14
    assert p1 != p2
    # Verify diversity
    assert any(c.isupper() for c in p1)
    assert any(c.islower() for c in p1)
    assert any(c.isdigit() for c in p1)
    assert any(c in "!@#$%^&*" for c in p1)


def test_username_generation():
    u1 = generate_roblox_username("kiZortShop")
    u2 = generate_roblox_username("kiZortShop")
    assert u1.startswith("kiZortShop_")
    assert u2.startswith("kiZortShop_")
    assert u1 != u2
    assert len(u1) <= 20
    assert not u1.endswith("_")


def test_parse_account_line():
    # Pipe format
    res1 = parse_account_line("user1|pass123|cookiedata")
    assert res1 == ("user1", "pass123", "cookiedata")

    # Colon format
    res2 = parse_account_line("user2:pass456:cookiedata2")
    assert res2 == ("user2", "pass456", "cookiedata2")

    # Only user|pass
    res3 = parse_account_line("user3|pass789")
    assert res3 == ("user3", "pass789", None)

    # Empty
    assert parse_account_line("   ") is None


def test_kaitun_service_stock_and_dispense(tmp_path):
    db_file = tmp_path / "test.sqlite3"
    db = Database(str(db_file))
    db.initialize()

    service = KaitunService(db)

    # Test batch generation
    creds = service.generate_credentials_batch(prefix="kiZortShop", count=3)
    assert len(creds) == 3
    for u, p in creds:
        assert u.startswith("kiZortShop_")
        assert len(p) >= 12

    # Test add stock
    bulk_input = """
    kiZortShop_01|Pass@1234|cookie_abc
    kiZortShop_02|Pass@5678|cookie_def
    kiZortShop_01|Pass@1234|cookie_abc
    invalid_line_without_delimiter
    """
    success, failed, failed_lines = service.add_stock_from_text(bulk_input, user_id=999)
    assert success == 2
    assert failed == 2  # 1 duplicate + 1 invalid

    # Check stats
    stats = service.get_stock_summary()
    assert stats["available"] == 2
    assert stats["used"] == 0
    assert stats["total"] == 2

    # Dispense 1 account
    dispensed = service.dispense_accounts(1, user_id=888)
    assert len(dispensed) == 1
    assert dispensed[0]["username"] == "kiZortShop_01"

    # Check stats after dispense
    stats_after = service.get_stock_summary()
    assert stats_after["available"] == 1
    assert stats_after["used"] == 1
    assert stats_after["total"] == 2

    # Dispense remaining
    dispensed2 = service.dispense_accounts(5, user_id=777)
    assert len(dispensed2) == 1
    assert dispensed2[0]["username"] == "kiZortShop_02"

    stats_empty = service.get_stock_summary()
    assert stats_empty["available"] == 0
    assert stats_empty["used"] == 2

    db.close()


def test_kaitun_account_update_and_filter(tmp_path):
    db_file = tmp_path / "test.sqlite3"
    db = Database(str(db_file))
    db.initialize()
    service = KaitunService(db)

    # Add account
    service.add_stock_from_text("kaimhaShozp_01|Pass#1234|cookie_1", user_id=123)

    # Initial state check
    acc = service.get_account("kaimhaShozp_01")
    assert acc is not None
    assert acc["sale_status"] == "unsold"
    assert acc["farmed_maps"] == ""

    # Update account with maps, details, and sale_status
    ok = service.update_account(
        username="kaimhaShozp_01",
        farmed_maps="Blox Fruits, King Legacy",
        details="LV 2550 หมัดก็อด ผลโมจิตื่น ดาบคู่",
        sale_status="sold",
        price="150 บาท",
    )
    assert ok is True

    # Verify update
    acc_updated = service.get_account("kaimhaShozp_01")
    assert acc_updated["farmed_maps"] == "Blox Fruits, King Legacy"
    assert acc_updated["details"] == "LV 2550 หมัดก็อด ผลโมจิตื่น ดาบคู่"
    assert acc_updated["sale_status"] == "sold"
    assert acc_updated["price"] == "150 บาท"

    # Test filter by sale_status
    sold_list = service.list_accounts(sale_status="sold")
    assert len(sold_list) == 1
    assert sold_list[0]["username"] == "kaimhaShozp_01"

    unsold_list = service.list_accounts(sale_status="unsold")
    assert len(unsold_list) == 0

    # Test filter by map query
    bf_list = service.list_accounts(map_query="Blox Fruits")
    assert len(bf_list) == 1

    db.close()


def test_prevent_duplicate_stock_and_detect_password_change(tmp_path):
    db_file = tmp_path / "test_dup.sqlite3"
    db = Database(str(db_file))
    db.initialize()
    service = KaitunService(db)

    # 1. Add initial stock
    res1 = service.add_stock_from_text("my_user_01|InitialPass#123", user_id=100)
    assert res1.success_count == 1
    assert res1.failed_count == 0
    assert len(res1.password_updated) == 0
    assert len(res1.duplicates) == 0

    # Verify 1 account in DB
    stats1 = service.get_stock_summary()
    assert stats1["total"] == 1
    assert stats1["available"] == 1

    # 2. Attempt to add EXACT DUPLICATE (same username, same password)
    res2 = service.add_stock_from_text("my_user_01|InitialPass#123", user_id=101)
    assert res2.success_count == 0
    assert res2.failed_count == 1
    assert "my_user_01" in res2.duplicates
    # Verify stock total did NOT increase!
    stats2 = service.get_stock_summary()
    assert stats2["total"] == 1

    # 3. Add existing username with DIFFERENT PASSWORD (Password change!)
    res3 = service.add_stock_from_text("my_user_01|NewSecretPassword#456|new_cookie", user_id=102)
    assert res3.success_count == 0  # not counted as a new stock entry
    assert len(res3.password_updated) == 1
    assert res3.password_updated[0]["username"] == "my_user_01"
    assert res3.password_updated[0]["new_password"] == "NewSecretPassword#456"

    # Verify password was updated in DB and total accounts is STILL 1
    acc = service.get_account("my_user_01")
    assert acc["password"] == "NewSecretPassword#456"
    stats3 = service.get_stock_summary()
    assert stats3["total"] == 1

    # 4. Explicit password update via update_account
    ok = service.update_account(username="my_user_01", password="DirectUpdatePass#789")
    assert ok is True
    acc_updated = service.get_account("my_user_01")
    assert acc_updated["password"] == "DirectUpdatePass#789"

    db.close()

