from pathlib import Path

import insightface
import pytest

TEST_API_KEY = "test-key-for-pytest"


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_API_KEY", TEST_API_KEY)


@pytest.fixture
def test_api_key() -> str:
    return TEST_API_KEY


@pytest.fixture
def sample_image_bytes() -> bytes:
    # InsightFace's own bundled demo/test asset — not a photo added to
    # this repo, and not a named real individual's photo. Standard
    # practice for exercising a CV pipeline without sourcing test
    # imagery of our own.
    package_dir = Path(insightface.__file__).parent
    image_path = package_dir / "data" / "images" / "t1.jpg"
    return image_path.read_bytes()
