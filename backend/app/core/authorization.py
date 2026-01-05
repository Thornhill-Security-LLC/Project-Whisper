from __future__ import annotations

from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_actor, require_actor_user
from app.db.models import UserAccount
from app.db.session import get_db

ORG_READ = "org.read"
ORG_MANAGE_USERS = "org.manage_users"
ORG_MANAGE_CONTROLS = "org.manage_controls"
ORG_MANAGE_EVIDENCE = "org.manage_evidence"
ORG_MANAGE_RISKS = "org.manage_risks"

_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "org_admin": {
        ORG_READ,
        ORG_MANAGE_USERS,
        ORG_MANAGE_CONTROLS,
        ORG_MANAGE_EVIDENCE,
        ORG_MANAGE_RISKS,
    },
    "org_member": {
        ORG_READ,
        ORG_MANAGE_EVIDENCE,
        ORG_MANAGE_RISKS,
    },
    "auditor": {ORG_READ},
}


def has_permission(role: str, action: str) -> bool:
    if role == "org_owner":
        return True
    return action in _ROLE_PERMISSIONS.get(role, set())


def require_permission(action: str) -> Callable[..., UserAccount]:
    def dependency(
        organisation_id: UUID,
        db: Session = Depends(get_db),
        actor: dict[str, UUID | str | None] = Depends(get_actor),
    ) -> UserAccount:
        actor_user = require_actor_user(
            db, actor["actor_user_id"], organisation_id
        )
        if not has_permission(actor_user.role, action):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Role does not have permission for this action: "
                    f"{action}"
                ),
            )
        return actor_user

    return dependency
