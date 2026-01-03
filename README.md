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
cd backend && alembic -c alembic.ini upgrade head
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

## Tenant-scoped reads + writes (dev scaffolding)

For all `/api/organisations/{organisation_id}/*` endpoints, include a tenant
context header that matches the path organisation ID:

```bash
X-Organisation-Id: <organisation_id>
```

Bootstrap the initial organisation + admin user (recommended first step):

```bash
curl -X POST http://localhost:8000/api/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"organisation_name":"Acme Security","admin_email":"admin@example.com","admin_display_name":"Admin User"}'
```

Use the returned `organisation.id` and `admin_user.id` values for subsequent
tenant-scoped API calls.

Create an organisation (requires an existing actor user ID):

```bash
curl -X POST http://localhost:8000/api/organisations \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Security"}'
```

Fetch the organisation (requires tenant header):

```bash
curl http://localhost:8000/api/organisations/<organisation_id> \
  -H "X-Organisation-Id: <organisation_id>"
```

List users in the organisation (requires tenant header):

```bash
curl http://localhost:8000/api/organisations/<organisation_id>/users \
  -H "X-Organisation-Id: <organisation_id>"
```

Create a user in that organisation:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/users \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","display_name":"Alex"}'
```

Create a risk:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/risks \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Credential stuffing","description":"Abuse of reused credentials","category":"security","likelihood":4,"impact":5,"status":"open","owner_user_id":"<actor_user_id>"}'
```

List risks:

```bash
curl http://localhost:8000/api/organisations/<organisation_id>/risks \
  -H "X-Organisation-Id: <organisation_id>"
```

Create a new risk version:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/risks/<risk_id>/versions \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Credential stuffing (expanded)","description":"Expanded scope","category":"security","likelihood":3,"impact":4,"status":"review","owner_user_id":"<actor_user_id>"}'
```

Create a control:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/controls \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"framework":"SOC2","control_code":"CC6.1","title":"Logical access","description":"Access controls are enforced","status":"Implemented","owner_user_id":"<actor_user_id>"}'
```

Create an evidence item:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/evidence \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Access policy","description":"Policy document","evidence_type":"policy","source":"manual","external_uri":"https://example.com/policy"}'
```

### Evidence Upload (local)

Upload a file-backed evidence item:

```bash
curl -X POST "http://localhost:8000/api/organisations/$ORG_ID/evidence/upload" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID" \
  -F "evidence_type=policy" \
  -F "title=Security Policy" \
  -F "file=@./README.md"
```

Download the evidence file:

```bash
curl -L -o downloaded.bin "http://localhost:8000/api/organisations/$ORG_ID/evidence/<EVIDENCE_ID>/download" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID"
```

## Evidence storage backends

Evidence uploads default to the local filesystem backend. To switch to Google Cloud Storage (GCS), configure the backend
environment variables before starting the backend service.

### Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `EVIDENCE_STORAGE_BACKEND` | Evidence storage backend (`local` or `gcs`). | `local` |
| `GCS_BUCKET_NAME` | GCS bucket name (required when backend is `gcs`). | — |
| `GCS_SIGNED_URL_TTL_SECONDS` | TTL for signed download URLs. | `300` |
| `GCP_PROJECT_ID` | Optional GCP project ID (client can infer if omitted). | — |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to a service account JSON for local dev. | — |

### Enable GCS locally

```bash
export EVIDENCE_STORAGE_BACKEND=gcs
export GCS_BUCKET_NAME=your-evidence-bucket
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

When the backend is set to `gcs`, download via signed URLs:

```bash
curl "http://localhost:8000/api/organisations/$ORG_ID/evidence/<EVIDENCE_ID>/download-url" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID"
```

Link evidence to a control:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/controls/<control_id>/evidence \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"evidence_item_id":"<evidence_item_id>"}'
```

All write endpoints (other than `/api/bootstrap`) require an `X-Actor-User-Id`
header that refers to a user in the target organisation.

If the `X-Organisation-Id` header does not match the path organisation ID, the
API returns `403 Cross-organisation access denied`. If the organisation ID is
invalid, the API returns a `404 Organisation not found` response. If a write
fails because of a database conflict, the API returns `409 Write failed` without
exposing database internals.

`POST /api/organisations` does **not** require the `X-Organisation-Id` header
because the organisation does not exist yet.

The `X-Actor-User-Id` header is dev-only scaffolding (until OIDC is implemented)
and is used to attribute audit events for write requests.

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
