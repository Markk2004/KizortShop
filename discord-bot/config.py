from dataclasses import dataclass
import os
from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    discord_token: str
    database_path: str
    key_prefix: str
    key_hex_length: int
    provider_enabled: bool = False
    provider_base_url: str = ""
    provider_api_key: str = ""
    provider_allowed_host: str = ""


def load_settings() -> Settings:
    load_dotenv()

    token = os.getenv("DISCORD_TOKEN")
    if not token or not token.strip():
        raise ValueError("DISCORD_TOKEN environment variable is required")

    database_path = os.getenv("DATABASE_PATH", "data/bot.sqlite3").strip()
    key_prefix = os.getenv("KEY_PREFIX", "FREE_")

    raw_hex_length = os.getenv("KEY_HEX_LENGTH", "32").strip()
    try:
        key_hex_length = int(raw_hex_length)
        if key_hex_length <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("KEY_HEX_LENGTH must be a positive integer")

    raw_enabled = os.getenv("PROVIDER_ENABLED", "false").strip().lower()
    provider_enabled = raw_enabled in ("true", "1", "yes")
    provider_base_url = os.getenv("PROVIDER_BASE_URL", "").strip()
    provider_api_key = os.getenv("PROVIDER_API_KEY", "").strip()
    provider_allowed_host = os.getenv("PROVIDER_ALLOWED_HOST", "").strip()

    return Settings(
        discord_token=token.strip(),
        database_path=database_path,
        key_prefix=key_prefix,
        key_hex_length=key_hex_length,
        provider_enabled=provider_enabled,
        provider_base_url=provider_base_url,
        provider_api_key=provider_api_key,
        provider_allowed_host=provider_allowed_host,
    )
