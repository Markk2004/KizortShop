import pytest
from config import Settings, load_settings


def test_load_settings_requires_discord_token(monkeypatch):
    monkeypatch.setattr("config.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.delenv("DISCORD_TOKEN", raising=False)
    with pytest.raises(ValueError, match="DISCORD_TOKEN"):
        load_settings()


def test_load_settings_reads_defaults(monkeypatch):
    monkeypatch.setattr("config.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("DISCORD_TOKEN", "test-token")
    monkeypatch.delenv("DATABASE_PATH", raising=False)
    monkeypatch.delenv("KEY_PREFIX", raising=False)
    monkeypatch.delenv("KEY_HEX_LENGTH", raising=False)
    monkeypatch.delenv("PROVIDER_ENABLED", raising=False)
    monkeypatch.delenv("PROVIDER_BASE_URL", raising=False)
    monkeypatch.delenv("PROVIDER_API_KEY", raising=False)
    monkeypatch.delenv("PROVIDER_ALLOWED_HOST", raising=False)
    settings = load_settings()
    assert settings.discord_token == "test-token"
    assert settings.database_path == "data/bot.sqlite3"
    assert settings.key_prefix == "FREE_"
    assert settings.key_hex_length == 32
    assert settings.provider_enabled is False
    assert settings.provider_base_url == ""
    assert settings.provider_api_key == ""
    assert settings.provider_allowed_host == ""


def test_load_settings_custom_values(monkeypatch):
    monkeypatch.setattr("config.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("DISCORD_TOKEN", "custom-token")
    monkeypatch.setenv("DATABASE_PATH", "custom/db.sqlite3")
    monkeypatch.setenv("KEY_PREFIX", "PRE_")
    monkeypatch.setenv("KEY_HEX_LENGTH", "16")
    monkeypatch.setenv("PROVIDER_ENABLED", "true")
    monkeypatch.setenv("PROVIDER_BASE_URL", "https://api.example.com")
    monkeypatch.setenv("PROVIDER_API_KEY", "secret-key")
    monkeypatch.setenv("PROVIDER_ALLOWED_HOST", "api.example.com")
    settings = load_settings()
    assert settings.discord_token == "custom-token"
    assert settings.database_path == "custom/db.sqlite3"
    assert settings.key_prefix == "PRE_"
    assert settings.key_hex_length == 16
    assert settings.provider_enabled is True
    assert settings.provider_base_url == "https://api.example.com"
    assert settings.provider_api_key == "secret-key"
    assert settings.provider_allowed_host == "api.example.com"


def test_load_settings_invalid_hex_length(monkeypatch):
    monkeypatch.setattr("config.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("DISCORD_TOKEN", "test-token")
    monkeypatch.setenv("KEY_HEX_LENGTH", "0")
    with pytest.raises(ValueError, match="KEY_HEX_LENGTH"):
        load_settings()

    monkeypatch.setenv("KEY_HEX_LENGTH", "-5")
    with pytest.raises(ValueError, match="KEY_HEX_LENGTH"):
        load_settings()

    monkeypatch.setenv("KEY_HEX_LENGTH", "not_a_number")
    with pytest.raises(ValueError, match="KEY_HEX_LENGTH"):
        load_settings()
