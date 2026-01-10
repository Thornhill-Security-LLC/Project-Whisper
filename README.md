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

## Running tests (recommended)

```bash
make test-docker
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

If the backend does not start, check `docker compose logs backend` for missing dependencies.

Verify the backend health checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/db
```

## Local Quickstart (5 minutes)

Run these steps from the repo root using the Makefile harness:

1) **Start the stack**

```bash
make up
```

Starts Docker Compose in the background. Next: run migrations.

2) **Run migrations**

```bash
make migrate
```

Applies Alembic migrations inside the backend container. Next: check health.

3) **Check health**

```bash
make health
```

Prints `/health` and `/health/db` JSON responses. Next: bootstrap IDs.

4) **Bootstrap an org + admin**

```bash
make bootstrap
```

Prints `ORG_ID`, `ADMIN_ID`, and `ADMIN_ROLE`, and writes them to `.dev_ids.env` for reuse.
To add another user with a specific role, run:

```bash
scripts/dev_create_user.sh user@example.com "New User" org_member
```

5) **Upload sample evidence**

```bash
make upload
```

Uploads `README.md` by default, prints `EVIDENCE_ID`, and appends it to `.dev_ids.env`.
If storage is local, it downloads the file to `downloaded_README.md`. If storage is GCS,
it writes the signed download URL to `gcs_download.md`.

6) **Show evidence routes**

```bash
make routes
```

Prints the evidence-related OpenAPI routes so you can explore downloads and links.

## Dev UI bootstrap

Use the UI scaffolding to create a dev organisation and actor session:

1) **Start the backend**

```bash
docker compose up --build
```

2) **Start the frontend**

```bash
cd frontend
npm ci
npm run dev
```

3) **Bootstrap via the UI**

- Open http://localhost:5173/login
- Click **Bootstrap Dev Org** to create an org + admin user
- You will be redirected to `/dashboard` and can visit `/risks` and `/controls`

## Authentication modes

Project Whisper supports two authentication scaffolding modes via `AUTH_MODE`:

- `dev` (default): use `X-Organisation-Id` plus actor headers for local/dev flows.
- `oidc`: validate OIDC JWTs and map them to existing `user_account` records.

### Dev mode (`AUTH_MODE=dev`)

Set `AUTH_MODE=dev` (or omit it) and continue using the header-based actor
scaffolding. Write actions still require `X-Actor-User-Id`.

### OIDC mode (`AUTH_MODE=oidc`)

Set the following environment variables:

```bash
AUTH_MODE=oidc
OIDC_ISSUER_URL=https://issuer.example.com
OIDC_AUDIENCE=api://your-audience
OIDC_JWKS_URL=https://issuer.example.com/.well-known/jwks.json
OIDC_CLOCK_SKEW_SECONDS=60
OIDC_JWKS_CACHE_SECONDS=3600
OIDC_HTTP_TIMEOUT_SECONDS=5
```

Requests must include:

- `Authorization: Bearer <JWT>`
- `X-Organisation-Id: <organisation_id>`

User accounts are **not** auto-provisioned. Users must already exist via
bootstrap/admin flows or explicit onboarding. Otherwise, requests return:
`User not provisioned for this organisation`.

Use the diagnostics endpoint to verify identity context:

```bash
curl http://localhost:8000/api/auth/whoami \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "Authorization: Bearer <JWT>"
```

## Org roles and permissions

Project Whisper uses org-scoped RBAC roles on `user_account.role`:

| Role | Capabilities |
| --- | --- |
| `org_owner` | Full access to all org actions. |
| `org_admin` | Manage users, controls, evidence, risks, and read all. |
| `org_member` | Manage evidence and risks, read all. |
| `auditor` | Read-only access. |

Permissions map to the following API action groups:

- `ORG_READ`
- `ORG_MANAGE_USERS`
- `ORG_MANAGE_CONTROLS`
- `ORG_MANAGE_EVIDENCE`
- `ORG_MANAGE_RISKS`

**Migration note:** existing users are defaulted to `org_admin` because bootstrap
origin is not yet detectable. New users default to `org_member` unless specified.

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
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>"
```

Create a user in that organisation:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/users \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","display_name":"Alex","role":"org_member"}'
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
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>"
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

Evidence upload uses `multipart/form-data` and requires `python-multipart` (included in backend requirements).

Download the evidence file:

```bash
curl -L -o downloaded.bin "http://localhost:8000/api/organisations/$ORG_ID/evidence/<EVIDENCE_ID>/download" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID"
```

If evidence is stored in GCS, `/download` returns `409 Evidence stored in GCS; use /download-url.`. If evidence is stored
locally, `/download-url` returns `409 Evidence stored locally; use /download.`.

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

The response contains the signed URL and TTL:

```json
{"url":"https://storage.googleapis.com/...","expires_in":300}
```

Upload evidence to GCS using the same upload endpoint:

```bash
curl -X POST "http://localhost:8000/api/organisations/$ORG_ID/evidence/upload" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID" \
  -F "evidence_type=policy" \
  -F "title=Security Policy" \
  -F "file=@./README.md"
```

Link evidence to a control:

```bash
curl -X POST http://localhost:8000/api/organisations/<organisation_id>/controls/<control_id>/evidence \
  -H "X-Organisation-Id: <organisation_id>" \
  -H "X-Actor-User-Id: <actor_user_id>" \
  -H "Content-Type: application/json" \
  -d '{"evidence_item_id":"<evidence_item_id>"}'
```

All read/write endpoints (other than `/api/bootstrap`) require an
`X-Actor-User-Id` header that refers to a user in the target organisation.

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

The frontend runs at `http://localhost:5173` by default and uses `VITE_API_BASE_URL`
to reach the backend (defaults to `http://localhost:8000`).

## Run backend and frontend together

In one terminal, run the backend:

```bash
docker compose up --build
```

In another terminal, run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Expected URLs:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
