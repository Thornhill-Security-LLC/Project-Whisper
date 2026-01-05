from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth import dev, oidc
from app.core.config import get_auth_mode
from app.db.models import UserAccount
from app.db.session import get_db


def get_actor(
    request: Request,
    db: Session = Depends(get_db),
    x_actor_user_id: str | None = Header(default=None, alias="X-Actor-User-Id"),
    x_actor_email: str | None = Header(default=None, alias="X-Actor-Email"),
) -> dict[str, UUID | str | None]:
    auth_mode = get_auth_mode()
    if auth_mode == "dev":
        return dev.get_actor(x_actor_user_id, x_actor_email)
    if auth_mode == "oidc":
        return oidc.get_actor(request, db)
    raise HTTPException(status_code=500, detail="Unsupported AUTH_MODE")


def require_actor_user(
    db: Session, actor_user_id: UUID, organisation_id: UUID | None = None
) -> UserAccount:
    # Use 401 for missing/invalid/unknown actors and 403 for org mismatches.
    actor_user = db.get(UserAccount, actor_user_id)
    if actor_user is None:
        raise HTTPException(status_code=401, detail="Actor user not found")
    if organisation_id is not None:
        if actor_user.organisation_id != organisation_id:
            raise HTTPException(
                status_code=403, detail="Actor not in organisation"
            )
    return actor_user
