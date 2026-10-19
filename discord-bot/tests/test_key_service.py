import pytest
from database import Database
from key_service import (
    KeyService,
    RedeemResult,
    extract_key,
    hash_key,
    is_valid_key,
    normalize_key,
)


def test_normalize_key():
    assert normalize_key("  FREE_12345  \n") == "FREE_12345"
    assert normalize_key("") == ""


def test_extract_key():
    valid_key = "FREE_" + "a" * 32
    assert extract_key(valid_key) == valid_key
    assert extract_key(f"https://example.com/api?data={valid_key}&user=123") == valid_key
    assert extract_key(f"Here is your key: {valid_key}") == valid_key
    assert extract_key("no_key_here") == "no_key_here"


def test_is_valid_key():
    valid_key = "FREE_" + "a" * 32
    assert is_valid_key(valid_key)
    assert is_valid_key("  " + valid_key + "  ")

    # Invalid prefix
    assert not is_valid_key("BAD_" + "a" * 32)
    # Invalid length
    assert not is_valid_key("FREE_" + "a" * 31)
    assert not is_valid_key("FREE_" + "a" * 33)
    # Invalid character (g is not hex)
    assert not is_valid_key("FREE_" + "g" * 32)
    # Empty
    assert not is_valid_key("")


def test_hash_key():
    key = "FREE_" + "0" * 32
    h1 = hash_key(key)
    h2 = hash_key(key)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex length
    assert h1 != key


def test_key_service_redeem_flow(tmp_path):
    db_file = tmp_path / "test.sqlite3"
    db = Database(str(db_file))
    db.initialize()

    service = KeyService(db, prefix="FREE_", hex_length=32)

    valid_key = "FREE_" + "f" * 32
    invalid_key = "FREE_" + "g" * 32

    # Redeem invalid format
    res_invalid = service.redeem(invalid_key, 100)
    assert not res_invalid.ok
    assert res_invalid.code == "invalid_format"

    # Redeem first time (success)
    res_success = service.redeem(valid_key, 100)
    assert res_success.ok
    assert res_success.code == "redeemed"
    assert res_success.extracted_key == valid_key

    # Verify database does not store raw key
    hashed = hash_key(valid_key)
    record = db.find_key(hashed)
    assert record is not None
    assert record["key_hash"] == hashed
    assert record["user_id"] == 100

    # Redeem duplicate key
    res_duplicate = service.redeem(valid_key, 200)
    assert not res_duplicate.ok
    assert res_duplicate.code == "already_redeemed"

    # Test generate_key
    ok, new_key = service.generate_key(400)
    assert ok is True
    assert is_valid_key(new_key, service.prefix, service.hex_length)
    assert service.database.find_key(hash_key(new_key)) is not None

    db.close()

