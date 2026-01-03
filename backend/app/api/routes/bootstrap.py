from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Organisation, UserAccount
from app.db.session import get_db
from app.schemas.bootstrap import BootstrapCreate, BootstrapOut
from app.services.audit import emit_audit_event

router = APIRouter(tags=["bootstrap"])


@router.post("/bootstrap", response_model=BootstrapOut)
def bootstrap(
    payload: BootstrapCreate,
    db: Session = Depends(get_db),
) -> BootstrapOut:
    try:
        with db.begin():
            organisation = Organisation(name=payload.organisation_name)
            db.add(organisation)
            db.flush()

            existing_admin = db.execute(
                select(UserAccount).where(
                    UserAccount.organisation_id == organisation.id,
                    UserAccount.email == payload.admin_email,
                )
            ).scalar_one_or_none()
            if existing_admin:
                raise HTTPException(
                    status_code=409,
                    detail="Admin email already exists for organisation",
                )

            admin_user = UserAccount(
                organisation_id=organisation.id,
                email=payload.admin_email,
                display_name=payload.admin_display_name,
            )
            db.add(admin_user)
            db.flush()

            emit_audit_event(
                db,
                organisation_id=organisation.id,
                actor_user_id=admin_user.id,
                actor_email=admin_user.email,
                action="organisation.created",
                entity_type="organisation",
                entity_id=organisation.id,
                metadata={"name": organisation.name},
            )
            emit_audit_event(
                db,
                organisation_id=organisation.id,
                actor_user_id=admin_user.id,
                actor_email=admin_user.email,
                action="user_account.created",
                entity_type="user_account",
                entity_id=admin_user.id,
                metadata={
                    "email": admin_user.email,
                    "display_name": admin_user.display_name,
                },
            )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed") from exc

    db.refresh(organisation)
    db.refresh(admin_user)
    return BootstrapOut(organisation=organisation, admin_user=admin_user)
