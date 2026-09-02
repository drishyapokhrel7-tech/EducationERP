# services/ai — face detection/embedding (Phase 6 slice 6b).
#
# CPU-only by design (face_model.py pins providers=["CPUExecutionProvider"]
# — no GPU needed, any standard container host works, keeping this
# deployable on a plain small VM/Railway/Fly.io instance rather than
# requiring GPU-backed hosting). Not serverless: FaceAnalysis is loaded
# once at process startup (see face_model.py's own docstring — model
# load is slow, inference on an already-loaded model isn't), so this
# needs a persistent, long-running process, not a cold-starting
# function — the reason this is a plain Dockerfile/host rather than a
# Vercel function like the other two services.
FROM python:3.11-slim AS base

# opencv-python-headless still dynamically links against a handful of
# system graphics libs at import time despite the "headless" name (a
# well-known upstream gotcha, not specific to this project) — without
# these, `import cv2` fails at container startup with a missing
# libGL.so/libgthread error.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Bake the InsightFace model into the image at build time instead of
# leaving it to download on the first real request (app/face_model.py's
# own doc comment: the download is a one-time, few-hundred-MB fetch).
# Doing it here means every container starts from an identical,
# already-warm image — no slow, unpredictable first request in
# production, and no reliance on the model host being reachable from
# inside the running container's network policy. FACE_MODEL_NAME can
# still be overridden at deploy time via a build ARG matching the same
# name, defaulting to face_model.py's own default (buffalo_l).
ARG FACE_MODEL_NAME=buffalo_l
ENV FACE_MODEL_NAME=${FACE_MODEL_NAME}
RUN python -c "from app.face_model import get_face_analysis; get_face_analysis()"

ENV PORT=8001
EXPOSE 8001

# AI_SERVICE_API_KEY is deliberately NOT set here — it's a secret,
# supplied by the hosting platform's own env-var configuration at
# deploy time (see docs/DEPLOYMENT.md), never baked into the image.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
