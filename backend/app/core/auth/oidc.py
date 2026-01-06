from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from jwt import InvalidTokenError

from app.core.config import get_oidc_audience, get_oidc_issuer_url
from app.core.oidc import verify_jwt
from app.core.tenant import require_tenant_context
from app.db.models import UserAccount


def get_actor(request: Request, db: Session) -> dict[str, UUID | str | None]:
    organisation_id = require_tenant_context(request)
    token = _get_bearer_token(request)

    issuer = get_oidc_issuer_url()
    audience = get_oidc_audience()
    if not issuer or not audience:
        raise HTTPException(
            status_code=500, detail="OIDC configuration missing"
        )

    try:
        claims = verify_jwt(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=401, detail="Invalid bearer token"
        ) from exc
    subject = claims.get("sub")
    email = claims.get("email")

    user = _find_user_account(
        db,
        organisation_id,
        email=email,
        subject=subject,
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


def _get_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return auth_header.split(" ", 1)[1].strip()
