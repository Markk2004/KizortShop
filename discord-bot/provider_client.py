from dataclasses import dataclass
import json
import logging
import time
from typing import Optional
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

DISALLOWED_DOMAINS = {
    "auth.platorelay.com",
    "links.lootlabs.gg",
    "lootlabs.gg",
    "platorelay.com",
}


@dataclass(frozen=True)
class ProviderResult:
    ok: bool
    key: Optional[str]
    provider: str
    error_code: Optional[str]
    elapsed_seconds: float


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_host: str):
        super().__init__()
        self.allowed_host = allowed_host.lower() if allowed_host else None

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme != "https":
            raise urllib.error.HTTPError(newurl, code, "Redirect to non-https rejected", headers, fp)
        if self.allowed_host and parsed.netloc.lower() != self.allowed_host:
            raise urllib.error.HTTPError(newurl, code, f"Redirect to unauthorized host {parsed.netloc} rejected", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ProviderClient:
    def __init__(
        self,
        base_url: str = "",
        api_key: str = "",
        allowed_host: str = "",
        timeout: float = 10.0,
        enabled: bool = False,
    ):
        self.base_url = base_url.strip()
        self.api_key = api_key.strip()
        self.allowed_host = allowed_host.strip().lower()
        self.timeout = timeout
        self.enabled = enabled

    def process_link(self, url: str) -> ProviderResult:
        start_time = time.time()

        if not self.enabled:
            return ProviderResult(
                ok=False,
                key=None,
                provider="Unconfigured",
                error_code="provider_not_configured",
                elapsed_seconds=0.0,
            )

        # Parse and validate URL scheme
        parsed = urllib.parse.urlparse(url.strip())
        if parsed.scheme != "https":
            return ProviderResult(
                ok=False,
                key=None,
                provider=self.allowed_host or "External",
                error_code="invalid_scheme",
                elapsed_seconds=0.0,
            )

        # Disallowed domains check
        netloc = parsed.netloc.lower()
        if netloc in DISALLOWED_DOMAINS or any(d in netloc for d in DISALLOWED_DOMAINS):
            logger.warning("Rejected attempt to access disallowed service host")
            return ProviderResult(
                ok=False,
                key=None,
                provider="Blocked",
                error_code="unauthorized_service",
                elapsed_seconds=0.0,
            )

        # Allowed host check
        if self.allowed_host and netloc != self.allowed_host:
            return ProviderResult(
                ok=False,
                key=None,
                provider=netloc,
                error_code="host_not_allowed",
                elapsed_seconds=0.0,
            )

        if not self.base_url:
            return ProviderResult(
                ok=False,
                key=None,
                provider="Unconfigured",
                error_code="provider_not_configured",
                elapsed_seconds=0.0,
            )

        # Build request to authorized provider
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DiscordKeyBot/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = json.dumps({"link": url}).encode("utf-8")
        req = urllib.request.Request(self.base_url, data=payload, headers=headers, method="POST")

        opener = urllib.request.build_opener(SafeRedirectHandler(self.allowed_host))
        try:
            with opener.open(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                key = data.get("key")
                provider_name = data.get("provider", self.allowed_host or "AuthorizedProvider")
                elapsed = round(time.time() - start_time, 2)
                return ProviderResult(
                    ok=True,
                    key=key,
                    provider=provider_name,
                    error_code=None,
                    elapsed_seconds=elapsed,
                )
        except urllib.error.HTTPError as e:
            elapsed = round(time.time() - start_time, 2)
            logger.error("Provider HTTP error: %s", e.code)
            return ProviderResult(
                ok=False,
                key=None,
                provider=self.allowed_host or "AuthorizedProvider",
                error_code=f"http_{e.code}",
                elapsed_seconds=elapsed,
            )
        except Exception as e:
            elapsed = round(time.time() - start_time, 2)
            logger.error("Provider request failed: %s", type(e).__name__)
            return ProviderResult(
                ok=False,
                key=None,
                provider=self.allowed_host or "AuthorizedProvider",
                error_code="network_error",
                elapsed_seconds=elapsed,
            )
