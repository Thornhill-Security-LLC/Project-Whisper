from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.auth import get_actor
from app.core.tenant import require_tenant_context

router = APIRouter(tags=["auth"])


@router.get("/auth/whoami")
def whoami(
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    organisation_id: UUID = Depends(require_tenant_context),
) -> dict[str, str | None]:
    actor_user_id = actor.get("actor_user_id")
    actor_email = actor.get("actor_email")
    actor_subject = actor.get("actor_subject")

    return {
        "auth_mode": actor.get("auth_mode"),
        "subject": str(actor_subject) if actor_subject else None,
        "email": str(actor_email) if actor_email else None,
        "user_id": str(actor_user_id) if actor_user_id else None,
        "organisation_id": str(organisation_id),
    }
