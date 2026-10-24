import asyncio

from agy_service import (
    AgyService,
    AgySettings,
    extract_response_text,
    load_agy_settings,
    split_for_discord,
)


def test_split_for_discord_respects_limit():
    text = ("บรรทัด\n" * 1000).strip()
    chunks = split_for_discord(text, limit=500)
    assert len(chunks) > 1
    assert all(len(c) <= 500 for c in chunks)


def test_split_for_discord_empty():
    assert split_for_discord("") == ["(ไม่มีข้อความตอบกลับ)"]


def test_extract_response_text_json_and_raw():
    assert extract_response_text('{"response": "hello"}') == "hello"
    assert extract_response_text("plain text") == "plain text"


def test_load_settings_parses_ids(monkeypatch):
    monkeypatch.setenv("AGY_ENABLED", "true")
    monkeypatch.setenv("AGY_ALLOWED_USER_IDS", "123, 456;abc")
    monkeypatch.setenv("AGY_CHANNEL_ID", "999")
    monkeypatch.setenv("AGY_TIMEOUT_SECONDS", "9999")
    s = load_agy_settings()
    assert s.enabled is True
    assert s.allowed_user_ids == {123, 456}
    assert s.channel_id == 999
    assert s.timeout_seconds == 300


def test_authorization_and_channel_checks():
    svc = AgyService(AgySettings(enabled=True, allowed_user_ids={1}, channel_id=10))
    assert svc.is_user_allowed(1)
    assert not svc.is_user_allowed(2)
    assert svc.is_channel_allowed(10)
    assert not svc.is_channel_allowed(11)


def test_build_command_is_read_only():
    svc = AgyService(AgySettings(enabled=True, model="m"))
    cmd = svc.build_command("agy", "hi")
    assert "--mode" in cmd and cmd[cmd.index("--mode") + 1] == "plan"
    assert "--sandbox" in cmd
    assert "--dangerously-skip-permissions" not in cmd


def test_run_disabled_returns_message():
    svc = AgyService(AgySettings(enabled=False))
    assert "ปิดอยู่" in asyncio.run(svc.run("hi"))
