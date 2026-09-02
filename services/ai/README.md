# services/ai — face detection/embedding (Phase 6 slice 6b)

The project's first Python service. Standalone this slice — no NestJS
integration yet (that's slice 6c, once `FaceEmbedding` exists to store
a result in). One route: `POST /v1/face/embed`, takes an image, returns
every detected face's bounding box, confidence, and a 512-dim
embedding. Does not decide what counts as "a good enrollment photo" —
that's a caller's business rule, not this service's.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then set a real AI_SERVICE_API_KEY
```

First request downloads the configured model (`FACE_MODEL_NAME`,
default `buffalo_l`) from InsightFace's own release hosting into
`~/.insightface/models/` — a one-time, few-hundred-MB download.

## Run

```bash
source .venv/bin/activate
export $(cat .env | xargs)
uvicorn app.main:app --port ${PORT:-8001}
```

## Test

```bash
source .venv/bin/activate
pytest
```

## Docker

`Dockerfile` builds a CPU-only image with the model baked in at build
time (no first-request download in production — see the Dockerfile's
own comments for why). See `../../docs/DEPLOYMENT.md` for the real
hosting story (this service needs a persistent host, not a
cold-starting serverless function).

```bash
docker build -t erp-ai .
docker run -p 8001:8001 -e AI_SERVICE_API_KEY=change-me erp-ai
```
