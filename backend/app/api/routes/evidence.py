from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.actor import get_actor, require_actor_user
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models import EvidenceItem, Organisation
from app.db.session import get_db
from app.schemas.evidence import EvidenceCreate, EvidenceOut
from app.services.audit import emit_audit_event

router = APIRouter(tags=["evidence"])


@router.post(
    "/organisations/{organisation_id}/evidence", response_model=EvidenceOut
)
def create_evidence_item(
    organisation_id: UUID,
    payload: EvidenceCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> EvidenceOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    actor_user = require_actor_user(
        db, actor["actor_user_id"], organisation_id
    )

    evidence = EvidenceItem(
        organisation_id=organisation_id,
        title=payload.title,
        description=payload.description,
        evidence_type=payload.evidence_type,
        source=payload.source,
        external_uri=payload.external_uri,
        sha256=payload.sha256,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        created_by_user_id=actor_user.id,
    )
    db.add(evidence)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="evidence_item.created",
        entity_type="evidence_item",
        entity_id=evidence.id,
        metadata={"title": payload.title, "evidence_type": payload.evidence_type},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(evidence)
    return evidence


@router.get(
    "/organisations/{organisation_id}/evidence", response_model=list[EvidenceOut]
)
def list_evidence_items(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[EvidenceOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    rows = db.execute(
        select(EvidenceItem).where(
            EvidenceItem.organisation_id == organisation_id
        )
    ).scalars()

    return list(rows)
