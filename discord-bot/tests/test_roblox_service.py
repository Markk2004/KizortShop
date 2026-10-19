from roblox_service import RobloxService


def test_roblox_service_initialization():
    service = RobloxService()
    assert isinstance(service.targets, list)
    assert "RobloxPlayerBeta.exe" in service.targets
    assert "MuMuPlayer.exe" in service.targets
    assert service.is_running is False


def test_roblox_service_duration_str():
    service = RobloxService()
    duration_str = service.get_duration_str()
    assert isinstance(duration_str, str)
    assert len(duration_str) > 0


def test_roblox_service_status_info():
    service = RobloxService()
    status = service.get_status_info()
    assert "is_running" in status
    assert "processes" in status
    assert "duration_str" in status
    assert "timestamp" in status
