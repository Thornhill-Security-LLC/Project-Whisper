from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.actor import get_actor
from app.db.models import UserAccount
from app.db.session import get_db
from app.schemas.user_account import UserAccountCreate, UserAccountOut
from app.services.audit import emit_audit_event

router = APIRouter(tags=["user_accounts"])


@router.post(
    "/organisations/{organisation_id}/users", response_model=UserAccountOut
)
def create_user_account(
    organisation_id: UUID,
    payload: UserAccountCreate,
    db: Session = Depends(get_db),
    actor: dict[str, UUID | None] = Depends(get_actor),
) -> UserAccount:
    user_account = UserAccount(
        organisation_id=organisation_id,
        email=payload.email,
        display_name=payload.display_name,
    )
    db.add(user_account)
    db.flush()

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor["actor_user_id"],
        action="user_account.created",
        entity_type="user_account",
        entity_id=user_account.id,
        metadata={
            "email": user_account.email,
            "display_name": user_account.display_name,
        },
    )

    db.commit()
    db.refresh(user_account)
    return user_account
