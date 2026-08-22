"""Thin wrapper around InsightFace's FaceAnalysis.

Model name is config, not code (Phase 0 architecture rule) — read from
FACE_MODEL_NAME, defaulting to buffalo_l (InsightFace's own recommended
production model). buffalo_s is a lighter/faster override, and is the
model actually exercised while verifying this slice's technical
approach before it was planned. Loaded once at process startup, not
per request — model load (including the first-run download) is slow;
inference on an already-loaded model is not.
"""

import os
from functools import lru_cache

from insightface.app import FaceAnalysis

FACE_MODEL_NAME = os.environ.get("FACE_MODEL_NAME", "buffalo_l")


@lru_cache(maxsize=1)
def get_face_analysis() -> FaceAnalysis:
    app = FaceAnalysis(name=FACE_MODEL_NAME, providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app
