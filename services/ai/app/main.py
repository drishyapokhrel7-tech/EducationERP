"""Phase 6 slice 6b — face detection/embedding, standalone.

One route: POST /v1/face/embed. Takes an image, returns every detected
face's bounding box, detection confidence, and a 512-dim embedding.
Deliberately does not decide what counts as "a good enrollment photo"
(exactly one clear face, high confidence) — that's a business rule for
whoever calls this (slice 6c), not this service's job. Nothing here
persists an image or an embedding; processing is transient, in memory,
for the lifetime of one request.
"""

import os

import cv2
import numpy as np
from fastapi import Depends, FastAPI, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .face_model import FACE_MODEL_NAME, get_face_analysis

app = FastAPI(title="Education ERP — AI service (face embedding)")
bearer_scheme = HTTPBearer(auto_error=False)


def require_api_key(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> None:
    expected = os.environ.get("AI_SERVICE_API_KEY")
    if not expected:
        # Fail closed, not open — a missing server-side secret must never
        # silently accept every request.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "AI_SERVICE_API_KEY is not configured")
    if credentials is None or credentials.credentials != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing API key")


class DetectedFace(BaseModel):
    bbox: list[float]
    detScore: float
    embedding: list[float]


class FaceEmbedResponse(BaseModel):
    faces: list[DetectedFace]
    # Which model actually produced these embeddings — a caller that
    # persists an embedding (slice 6c) needs the *true* model name, not
    # a value it guesses from its own copy of an env var that could
    # drift out of sync with what this service is actually running.
    modelName: str


@app.post("/v1/face/embed", response_model=FaceEmbedResponse, dependencies=[Depends(require_api_key)])
async def embed_faces(image: UploadFile) -> FaceEmbedResponse:
    raw = await image.read()
    buffer = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not decode image")

    analysis = get_face_analysis()
    faces = analysis.get(img)

    return FaceEmbedResponse(
        faces=[
            DetectedFace(
                bbox=[float(v) for v in f.bbox],
                detScore=float(f.det_score),
                embedding=[float(v) for v in f.embedding],
            )
            for f in faces
        ],
        modelName=FACE_MODEL_NAME,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
