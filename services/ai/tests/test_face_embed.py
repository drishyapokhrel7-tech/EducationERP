from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_rejects_missing_api_key(sample_image_bytes):
    res = client.post("/v1/face/embed", files={"image": ("t1.jpg", sample_image_bytes, "image/jpeg")})
    assert res.status_code == 401


def test_rejects_wrong_api_key(sample_image_bytes):
    res = client.post(
        "/v1/face/embed",
        files={"image": ("t1.jpg", sample_image_bytes, "image/jpeg")},
        headers={"Authorization": "Bearer not-the-right-key"},
    )
    assert res.status_code == 401


def test_detects_faces_and_returns_embeddings(sample_image_bytes, test_api_key):
    res = client.post(
        "/v1/face/embed",
        files={"image": ("t1.jpg", sample_image_bytes, "image/jpeg")},
        headers={"Authorization": f"Bearer {test_api_key}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["faces"]) >= 1
    face = body["faces"][0]
    assert len(face["embedding"]) == 512
    assert 0.0 <= face["detScore"] <= 1.0
    assert len(face["bbox"]) == 4
    assert body["modelName"]


def test_rejects_undecodable_image(test_api_key):
    res = client.post(
        "/v1/face/embed",
        files={"image": ("bad.jpg", b"not a real image", "image/jpeg")},
        headers={"Authorization": f"Bearer {test_api_key}"},
    )
    assert res.status_code == 400
