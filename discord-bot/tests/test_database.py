import os
import pytest
from database import Database


def test_database_lifecycle_and_schema(tmp_path):
    db_file = tmp_path / "test.sqlite3"
    db = Database(str(db_file))
    db.initialize()

    # Query sqlite_master to verify table creation
    cursor = db.connection.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='redeemed_keys'")
    assert cursor.fetchone() is not None
    db.close()


def test_insert_and_find_key(tmp_path):
    db_file = tmp_path / "test.sqlite3"
    db = Database(str(db_file))
    db.initialize()

    # Insert first time should succeed
    assert db.insert_key("hash123", 1001) is True

    # Find key should return record dictionary
    record = db.find_key("hash123")
    assert record is not None
    assert record["key_hash"] == "hash123"
    assert record["user_id"] == 1001
    assert "redeemed_at" in record

    # Non-existent key returns None
    assert db.find_key("nonexistent") is None

    # Insert duplicate key should fail and return False
    assert db.insert_key("hash123", 1002) is False

    db.close()


def test_database_auto_creates_parent_directory(tmp_path):
    nested_dir = tmp_path / "nested" / "sub"
    db_file = nested_dir / "test.sqlite3"
    db = Database(str(db_file))
    db.initialize()

    assert os.path.exists(str(db_file))
    assert db.insert_key("hash456", 2002) is True
    db.close()


def test_add_expense_payload_includes_uuid(tmp_path, monkeypatch):
    import requests
    db_file = tmp_path / "test.sqlite3"
    db = Database(str(db_file))

    captured_payload = {}

    class MockResponse:
        status_code = 201
        def json(self):
            return [captured_payload]

    def mock_post(url, headers=None, data=None, timeout=None):
        import json
        nonlocal captured_payload
        captured_payload = json.loads(data)
        return MockResponse()

    monkeypatch.setattr(requests, "post", mock_post)

    result = db.add_expense("ค่าสคริปต์ฟาร์ม", 150.0, "SCRIPT", "ทดสอบ")
    assert result is not None
    assert "id" in captured_payload
    assert len(captured_payload["id"]) == 36  # Valid UUID4 string
    assert captured_payload["title"] == "ค่าสคริปต์ฟาร์ม"
    assert captured_payload["amount"] == 150.0
    assert captured_payload["category"] == "SCRIPT"
    db.close()
