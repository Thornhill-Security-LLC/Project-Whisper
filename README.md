# Project Whisper

Minimal Phase 0 skeleton with a FastAPI backend and Vite + React frontend.

## Prerequisites

- Docker + Docker Compose
- Node.js LTS (for running the frontend locally)
- Python 3.11 (optional for running backend tests locally)

## Quick start

```bash
git clone https://github.com/Milosmithy58/Project-Whisper.git
cd Project-Whisper

docker compose up --build
```

Run the database migrations:

```bash
cd backend
alembic upgrade head
```

Run the backend locally:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Verify the backend health checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/db
```

## Frontend local dev

```bash
cd frontend
npm install
npm run dev
```

The UI includes an “API Health” button that calls `http://localhost:8000/health`.
