import pytest
from database import Database
from key_service import KeyService
from provider_client import ProviderClient, ProviderResult
from process_service import ProcessService, ProcessResult


class MockProviderClient(ProviderClient):
    def __init__(self, mock_result: ProviderResult):
        super().__init__(enabled=True)
        self.mock_result = mock_result

    def process_link(self, url: str) -> ProviderResult:
        return self.mock_result


def test_provider_client_disabled_by_default():
    client = ProviderClient(enabled=False)
    result = client.process_link("https://example.com/test")
    assert not result.ok
    assert result.error_code == "provider_not_configured"


def test_provider_client_rejects_non_https():
    client = ProviderClient(enabled=True, allowed_host="api.example.com")
    result = client.process_link("http://api.example.com/test")
    assert not result.ok
    assert result.error_code == "invalid_scheme"


def test_provider_client_rejects_unallowed_host():
    client = ProviderClient(enabled=True, allowed_host="api.example.com")
    result = client.process_link("https://malicious.com/test")
    assert not result.ok
    assert result.error_code == "host_not_allowed"


def test_provider_client_blocks_disallowed_services():
    client = ProviderClient(enabled=True, allowed_host="")
    res1 = client.process_link("https://auth.platorelay.com/a?d=123")
    assert not res1.ok
    assert res1.error_code == "unauthorized_service"

    res2 = client.process_link("https://links.lootlabs.gg/s?abc")
    assert not res2.ok
    assert res2.error_code == "unauthorized_service"


def test_process_service_with_disabled_provider(tmp_path):
    db = Database(str(tmp_path / "test.sqlite3"))
    db.initialize()
    key_service = KeyService(db)
    client = ProviderClient(enabled=False)
    service = ProcessService(client, key_service)

    res = service.process("https://example.com/test", 100)
    assert not res.ok
    assert res.code == "provider_not_configured"
    db.close()


def test_process_service_success_flow(tmp_path):
    db = Database(str(tmp_path / "test.sqlite3"))
    db.initialize()
    key_service = KeyService(db)

    valid_key = "FREE_" + "c" * 32
    mock_client = MockProviderClient(
        ProviderResult(
            ok=True,
            key=valid_key,
            provider="OfficialPartnerAPI",
            error_code=None,
            elapsed_seconds=0.45,
        )
    )
    service = ProcessService(mock_client, key_service)

    res = service.process("https://partner.com/task/123", 101)
    assert res.ok
    assert res.code == "success"
    assert res.key == valid_key
    assert res.provider == "OfficialPartnerAPI"

    # Second time should fail as already redeemed
    res2 = service.process("https://partner.com/task/123", 102)
    assert not res2.ok
    assert res2.code == "already_redeemed"

    db.close()


def test_process_service_invalid_key_from_provider(tmp_path):
    db = Database(str(tmp_path / "test.sqlite3"))
    db.initialize()
    key_service = KeyService(db)

    mock_client = MockProviderClient(
        ProviderResult(
            ok=True,
            key="INVALID_KEY",
            provider="PartnerAPI",
            error_code=None,
            elapsed_seconds=0.3,
        )
    )
    service = ProcessService(mock_client, key_service)

    res = service.process("https://partner.com/task/456", 103)
    assert not res.ok
    assert res.code == "invalid_key_from_provider"
    db.close()
