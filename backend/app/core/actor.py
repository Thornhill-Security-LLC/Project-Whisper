from __future__ import annotations

import logging
from uuid import UUID

from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)


def get_actor(
    x_actor_user_id: str | None = Header(default=None, alias="X-Actor-User-Id"),
    x_actor_email: str | None = Header(default=None, alias="X-Actor-Email"),
) -> dict[str, UUID | str | None]:
    """Dev-only actor identity scaffolding until OIDC is in place."""
    actor_user_id: UUID | None = None

    if x_actor_user_id:
        try:
            actor_user_id = UUID(x_actor_user_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail="Invalid X-Actor-User-Id header"
            ) from exc

    if x_actor_email:
        logger.info(
            "Using dev actor header", extra={"actor_email": x_actor_email}
        )

    return {"actor_user_id": actor_user_id, "actor_email": x_actor_email}
