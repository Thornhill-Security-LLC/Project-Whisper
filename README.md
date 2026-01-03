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

## Tenant-scoped writes (dev scaffolding)

Create an organisation:

```bash
curl -X POST http://localhost:8000/api/organisations \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Security"}'
```

Create a user in that organisation:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","display_name":"Alex"}'
```

After a user exists, you may pass their ID as `X-Actor-User-Id` for subsequent
tenant-scoped writes.

If the organisation ID is invalid, the API returns a `404 Organisation not found`
response. If a write fails because of a database conflict, the API returns
`409 Write failed` without exposing database internals.

The `X-Actor-User-Id` header is optional dev-only scaffolding (until OIDC is
implemented) and is used to attribute audit events when supplied. If an actor ID
is provided but does not exist yet, it is treated as unverified and stored in
audit metadata for traceability without breaking writes.

Check audit events with psql:

```bash
psql "$DATABASE_URL" \
  -c "SELECT action, entity_type, entity_id, metadata, created_at FROM audit_event ORDER BY created_at DESC LIMIT 20;"
```

## Frontend local dev

```bash
cd frontend
npm install
npm run dev
```

The UI includes an “API Health” button that calls `http://localhost:8000/health`.
