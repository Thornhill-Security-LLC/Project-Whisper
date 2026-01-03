from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import AuditEvent


def emit_audit_event(
    db: Session,
    organisation_id: UUID,
    actor_user_id: UUID | None,
    action: str,
    entity_type: str | None,
    entity_id: UUID | None,
    metadata: dict[str, Any] | None,
) -> AuditEvent:
    event = AuditEvent(
        organisation_id=organisation_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_=metadata,
    )
    db.add(event)
    return event
