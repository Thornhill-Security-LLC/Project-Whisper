from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_actor
from app.core.authorization import ORG_MANAGE_USERS, ORG_READ, require_permission
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models import Organisation, UserAccount
from app.db.session import get_db
from app.schemas.user_account import UserAccountCreate, UserAccountOut
from app.services.audit import emit_audit_event

router = APIRouter(tags=["user_accounts"])


@router.get(
    "/organisations/{organisation_id}/users",
    response_model=list[UserAccountOut],
)
def list_user_accounts(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> list[UserAccount]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    return (
        db.execute(
            select(UserAccount).where(
                UserAccount.organisation_id == organisation_id
            )
        )
        .scalars()
        .all()
    )


@router.post(
    "/organisations/{organisation_id}/users", response_model=UserAccountOut
)
def create_user_account(
    organisation_id: UUID,
    payload: UserAccountCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_USERS)),
) -> UserAccount:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    metadata = {"email": payload.email, "display_name": payload.display_name}

    if actor.get("actor_email") and "actor_email" not in metadata:
        metadata["actor_email"] = actor["actor_email"]

    user_account = UserAccount(
        organisation_id=organisation_id,
        email=payload.email,
        display_name=payload.display_name,
        role=payload.role or "org_member",
    )
    db.add(user_account)
    db.flush()

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="user_account.created",
        entity_type="user_account",
        entity_id=user_account.id,
        metadata=metadata,
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(user_account)
    return user_account
