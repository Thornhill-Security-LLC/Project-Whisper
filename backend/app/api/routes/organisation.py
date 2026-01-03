from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.actor import get_actor
from app.db.models import Organisation
from app.db.session import get_db
from app.schemas.organisation import OrganisationCreate, OrganisationOut
from app.services.audit import emit_audit_event

router = APIRouter(tags=["organisations"])


@router.post("/organisations", response_model=OrganisationOut)
def create_organisation(
    payload: OrganisationCreate,
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
) -> Organisation:
    organisation = Organisation(name=payload.name)
    db.add(organisation)
    db.flush()

    metadata = {"name": organisation.name}
    if actor.get("actor_email"):
        metadata["actor_email"] = actor["actor_email"]

    emit_audit_event(
        db,
        organisation_id=organisation.id,
        actor_user_id=actor["actor_user_id"],
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
