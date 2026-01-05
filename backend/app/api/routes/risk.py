from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_actor
from app.core.authorization import ORG_MANAGE_RISKS, ORG_READ, require_permission
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models import Organisation, Risk, RiskVersion, UserAccount
from app.db.session import get_db
from app.schemas.risk import RiskCreate, RiskOut, RiskVersionCreate
from app.services.audit import emit_audit_event

router = APIRouter(tags=["risks"])


def _require_risk_for_org(
    db: Session, organisation_id: UUID, risk_id: UUID
) -> Risk:
    risk = (
        db.execute(
            select(Risk).where(
                Risk.id == risk_id,
                Risk.organisation_id == organisation_id,
            )
        )
        .scalars()
        .first()
    )
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    return risk


def _require_owner_user(
    db: Session, organisation_id: UUID, owner_user_id: UUID
) -> None:
    owner_user = db.get(UserAccount, owner_user_id)
    if owner_user is None or owner_user.organisation_id != organisation_id:
        raise HTTPException(
            status_code=400, detail="Owner user must belong to organisation"
        )


def _risk_out_from_latest(risk: Risk, version: RiskVersion) -> RiskOut:
    return RiskOut(
        risk_id=risk.id,
        organisation_id=risk.organisation_id,
        latest_version=version.version,
        title=version.title,
        description=version.description,
        category=version.category,
        likelihood=version.likelihood,
        impact=version.impact,
        score=version.likelihood * version.impact,
        status=version.status,
        owner_user_id=version.owner_user_id,
        created_at=risk.created_at,
        updated_at=version.created_at,
    )


@router.post(
    "/organisations/{organisation_id}/risks", response_model=RiskOut
)
def create_risk(
    organisation_id: UUID,
    payload: RiskCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_RISKS)),
) -> RiskOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    if payload.owner_user_id is not None:
        _require_owner_user(db, organisation_id, payload.owner_user_id)

    risk = Risk(organisation_id=organisation_id)
    db.add(risk)
    db.flush()

    risk_version = RiskVersion(
        organisation_id=organisation_id,
        risk_id=risk.id,
        version=1,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        likelihood=payload.likelihood,
        impact=payload.impact,
        status=payload.status,
        owner_user_id=payload.owner_user_id,
        created_by_user_id=actor_user.id,
    )
    db.add(risk_version)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="risk.created",
        entity_type="risk",
        entity_id=risk.id,
        metadata={"title": payload.title},
    )
    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="risk.version_created",
        entity_type="risk_version",
        entity_id=risk_version.id,
        metadata={"risk_id": str(risk.id), "version": 1},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(risk)
    db.refresh(risk_version)
    return _risk_out_from_latest(risk, risk_version)


@router.get(
    "/organisations/{organisation_id}/risks", response_model=list[RiskOut]
)
def list_risks(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> list[RiskOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    latest_versions_subq = (
        select(
            RiskVersion.risk_id,
            func.max(RiskVersion.version).label("max_version"),
        )
        .where(RiskVersion.organisation_id == organisation_id)
        .group_by(RiskVersion.risk_id)
        .subquery()
    )

    rows = db.execute(
        select(Risk, RiskVersion)
        .join(
            latest_versions_subq,
            latest_versions_subq.c.risk_id == Risk.id,
        )
        .join(
            RiskVersion,
            (RiskVersion.risk_id == latest_versions_subq.c.risk_id)
            & (RiskVersion.version == latest_versions_subq.c.max_version),
        )
        .where(Risk.organisation_id == organisation_id)
    ).all()

    return [_risk_out_from_latest(risk, version) for risk, version in rows]


@router.get(
    "/organisations/{organisation_id}/risks/{risk_id}",
    response_model=RiskOut,
)
def get_risk(
    organisation_id: UUID,
    risk_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> RiskOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    risk = _require_risk_for_org(db, organisation_id, risk_id)

    version = (
        db.execute(
            select(RiskVersion)
            .where(RiskVersion.risk_id == risk.id)
            .order_by(RiskVersion.version.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Risk version not found")

    return _risk_out_from_latest(risk, version)


@router.post(
    "/organisations/{organisation_id}/risks/{risk_id}/versions",
    response_model=RiskOut,
)
def create_risk_version(
    organisation_id: UUID,
    risk_id: UUID,
    payload: RiskVersionCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_RISKS)),
) -> RiskOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    risk = _require_risk_for_org(db, organisation_id, risk_id)
    if payload.owner_user_id is not None:
        _require_owner_user(db, organisation_id, payload.owner_user_id)

    next_version = (
        db.execute(
            select(func.max(RiskVersion.version)).where(
                RiskVersion.risk_id == risk.id
            )
        )
        .scalar_one_or_none()
        or 0
    ) + 1

    risk_version = RiskVersion(
        organisation_id=organisation_id,
        risk_id=risk.id,
        version=next_version,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        likelihood=payload.likelihood,
        impact=payload.impact,
        status=payload.status,
        owner_user_id=payload.owner_user_id,
        created_by_user_id=actor_user.id,
    )
    db.add(risk_version)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="risk.version_created",
        entity_type="risk_version",
        entity_id=risk_version.id,
        metadata={"risk_id": str(risk.id), "version": next_version},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(risk)
    db.refresh(risk_version)
    return _risk_out_from_latest(risk, risk_version)
