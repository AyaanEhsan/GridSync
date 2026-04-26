# GridSync

GridSync is a starter project for electric-grid reliability intelligence.

- `backend/` contains a FastAPI service (currently scaffolded and running with a fallback RAG agent).
- `data_pipeline/` is intended for PDF ingestion, preprocessing, and vectorization workflows.

## Current API Status

The backend currently exposes:

- `GET /` for a basic service message.
- `GET /health` for a health/version check.
- `GET /docs` for interactive Swagger UI.

The RAG layer is intentionally bootstrapped with a fallback response so the API is usable before full retrieval and generation are wired.

## Backend Quickstart (Conda)

### 1) Create and activate a Conda environment

```bash
conda create -n gridsync python=3.11 -y
conda activate gridsync
```

### 2) Install dependencies

From the repository root:

```bash
pip install -r backend/requirements.txt
```

### 3) Configure environment variables (optional but recommended)

Create `.env` in the project root:

```env
OPENAI_API_KEY=your_key_here
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=nerc_event_analysis_reports
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 4) Run the API server

From `backend/`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Verify the API

- Swagger: `http://localhost:8000/docs`
- Root endpoint: `http://localhost:8000/`
- Health endpoint: `http://localhost:8000/health`

Quick checks:

```bash
curl "http://localhost:8000/"
curl "http://localhost:8000/health"
```

## Common Conda Commands

```bash
conda activate gridsync
conda deactivate
conda env list
```

