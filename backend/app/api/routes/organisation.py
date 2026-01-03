from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.actor import get_actor, require_actor_user
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models.organisation import Organisation
from app.db.session import get_db
from app.schemas.organisation import OrganisationCreate, OrganisationOut
from app.services.audit import emit_audit_event

router = APIRouter(tags=["organisations"])


@router.get("/organisations/{organisation_id}", response_model=OrganisationOut)
def get_organisation(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> OrganisationOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    return organisation


@router.post("/organisations", response_model=OrganisationOut)
def create_organisation(
    payload: OrganisationCreate,
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> OrganisationOut:
    actor_user = require_actor_user(db, actor["actor_user_id"])
    organisation = Organisation(name=payload.name)
    db.add(organisation)
    db.flush()

    metadata = {"name": organisation.name}
    if actor.get("actor_email"):
        metadata["actor_email"] = actor["actor_email"]

    emit_audit_event(
        db,
        organisation_id=organisation.id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="organisation.created",
        entity_type="organisation",
        entity_id=organisation.id,
        metadata=metadata,
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(organisation)
    return organisation
