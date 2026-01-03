from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import AuditEvent, UserAccount


def emit_audit_event(
    db: Session,
    organisation_id: UUID,
    actor_user_id: UUID | None,
    actor_email: str | None,
    action: str,
    entity_type: str | None,
    entity_id: UUID | None,
    metadata: dict[str, Any] | None,
) -> AuditEvent:
    metadata = metadata.copy() if metadata else {}
    actor_user_id_to_store = actor_user_id

    if actor_user_id is not None:
        actor = db.get(UserAccount, actor_user_id)
        if actor is None:
            actor_user_id_to_store = None
            metadata["actor_user_id_unverified"] = str(actor_user_id)
            if actor_email:
                metadata["actor_email"] = actor_email

    event = AuditEvent(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id_to_store,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata,
    )
    db.add(event)
    return event
