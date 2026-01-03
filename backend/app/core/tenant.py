from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, Request


def require_tenant_context(request: Request) -> UUID:
    organisation_header = request.headers.get("X-Organisation-Id")
    if not organisation_header:
        raise HTTPException(
            status_code=400, detail="X-Organisation-Id header required"
        )

    try:
        return UUID(organisation_header)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="X-Organisation-Id header required"
        ) from exc


def assert_path_matches_tenant(
    path_org_id: UUID, tenant_org_id: UUID
) -> None:
    if path_org_id != tenant_org_id:
        raise HTTPException(
            status_code=403, detail="Cross-organisation access denied"
        )
