from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.oidc import verify_bearer_token, verify_jwt
from app.core.tenant import require_tenant_context
from app.db.models import UserAccount


def get_actor(request: Request, db: Session) -> dict[str, UUID | str | None]:
    organisation_header = request.headers.get("X-Organisation-Id")
    token = verify_bearer_token(request.headers.get("Authorization"))
    claims = verify_jwt(token)
    if not organisation_header:
        raise HTTPException(
            status_code=400, detail="X-Organisation-Id header required"
        )
    organisation_id = require_tenant_context(request)
    subject = claims.get("sub")
    email = claims.get("email")

    user = _find_user_account(
        db,
        organisation_id,
        email,
        subject,
    )
    if user is None:
        raise HTTPException(
            status_code=403,
            detail="User not provisioned for this organisation",
        )

    return {
        "actor_user_id": user.id,
        "actor_email": user.email,
        "actor_subject": subject,
        "auth_mode": "oidc",
    }


def _find_user_account(
    db: Session,
    organisation_id: UUID,
    email: str | None,
    subject: str | None,
) -> UserAccount | None:
    if email:
        user = (
            db.execute(
                select(UserAccount).where(
                    UserAccount.organisation_id == organisation_id,
                    UserAccount.email == email,
                )
            )
            .scalars()
            .one_or_none()
        )
        if user:
            return user

    if subject:
        user = (
            db.execute(
                select(UserAccount).where(
                    UserAccount.organisation_id == organisation_id,
                    UserAccount.email == subject,
                )
            )
            .scalars()
            .one_or_none()
        )
        if user:
            return user

    return None
