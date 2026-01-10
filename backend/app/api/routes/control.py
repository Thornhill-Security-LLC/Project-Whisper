from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_actor
from app.core.authorization import (
    ORG_MANAGE_CONTROLS,
    ORG_READ,
    require_permission,
)
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models import (
    Control,
    ControlEvidenceLink,
    ControlVersion,
    EvidenceItem,
    Organisation,
    UserAccount,
)
from app.db.session import get_db
from app.schemas.control import (
    ControlCreate,
    ControlEvidenceLinkCreate,
    ControlEvidenceLinkOut,
    ControlOut,
    ControlVersionCreate,
    ControlVersionOut,
)
from app.services.audit import emit_audit_event

router = APIRouter(tags=["controls"])


def _require_control_for_org(
    db: Session, organisation_id: UUID, control_id: UUID
) -> Control:
    control = (
        db.execute(
            select(Control).where(
                Control.id == control_id,
                Control.organisation_id == organisation_id,
            )
        )
        .scalars()
        .first()
    )
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")
    return control


def _require_evidence_for_org(
    db: Session, organisation_id: UUID, evidence_item_id: UUID
) -> EvidenceItem:
    evidence = db.get(EvidenceItem, evidence_item_id)
    if evidence is None or evidence.organisation_id != organisation_id:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    return evidence


def _require_owner_user(
    db: Session, organisation_id: UUID, owner_user_id: UUID
) -> None:
    owner_user = db.get(UserAccount, owner_user_id)
    if owner_user is None or owner_user.organisation_id != organisation_id:
        raise HTTPException(
            status_code=400, detail="Owner user must belong to organisation"
        )


def _control_out_from_latest(
    control: Control, version: ControlVersion
) -> ControlOut:
    return ControlOut(
        control_id=control.id,
        organisation_id=control.organisation_id,
        latest_version=version.version,
        framework=version.framework,
        control_code=version.control_code,
        title=version.title,
        description=version.description,
        status=version.status,
        owner_user_id=version.owner_user_id,
        score=None,
        created_at=control.created_at,
        updated_at=version.created_at,
    )


@router.post(
    "/organisations/{organisation_id}/controls", response_model=ControlOut
)
def create_control(
    organisation_id: UUID,
    payload: ControlCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_CONTROLS)),
) -> ControlOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    if payload.owner_user_id is not None:
        _require_owner_user(db, organisation_id, payload.owner_user_id)

    control = Control(organisation_id=organisation_id)
    db.add(control)
    db.flush()

    control_version = ControlVersion(
        organisation_id=organisation_id,
        control_id=control.id,
        version=1,
        control_code=payload.control_code,
        title=payload.title,
        description=payload.description,
        framework=payload.framework,
        status=payload.status,
        owner_user_id=payload.owner_user_id,
        created_by_user_id=actor_user.id,
    )
    db.add(control_version)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="control.created",
        entity_type="control",
        entity_id=control.id,
        metadata={"control_code": payload.control_code, "title": payload.title},
    )
    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="control.version_created",
        entity_type="control_version",
        entity_id=control_version.id,
        metadata={"control_id": str(control.id), "version": 1},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(control)
    db.refresh(control_version)
    return _control_out_from_latest(control, control_version)


@router.get(
    "/organisations/{organisation_id}/controls", response_model=list[ControlOut]
)
def list_controls(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> list[ControlOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    latest_versions_subq = (
        select(
            ControlVersion.control_id,
            func.max(ControlVersion.version).label("max_version"),
        )
        .where(ControlVersion.organisation_id == organisation_id)
        .group_by(ControlVersion.control_id)
        .subquery()
    )

    rows = db.execute(
        select(Control, ControlVersion)
        .join(
            latest_versions_subq,
            latest_versions_subq.c.control_id == Control.id,
        )
        .join(
            ControlVersion,
            (ControlVersion.control_id == latest_versions_subq.c.control_id)
            & (ControlVersion.version == latest_versions_subq.c.max_version),
        )
        .where(Control.organisation_id == organisation_id)
    ).all()

    return [_control_out_from_latest(control, version) for control, version in rows]


@router.get(
    "/organisations/{organisation_id}/controls/{control_id}",
    response_model=ControlOut,
)
def get_control(
    organisation_id: UUID,
    control_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> ControlOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    control = _require_control_for_org(db, organisation_id, control_id)

    version = (
        db.execute(
            select(ControlVersion)
            .where(ControlVersion.control_id == control.id)
            .order_by(ControlVersion.version.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Control version not found")

    return _control_out_from_latest(control, version)


@router.post(
    "/organisations/{organisation_id}/controls/{control_id}/versions",
    response_model=ControlOut,
)
def create_control_version(
    organisation_id: UUID,
    control_id: UUID,
    payload: ControlVersionCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_CONTROLS)),
) -> ControlOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    control = _require_control_for_org(db, organisation_id, control_id)
    if payload.owner_user_id is not None:
        _require_owner_user(db, organisation_id, payload.owner_user_id)

    next_version = (
        db.execute(
            select(func.max(ControlVersion.version)).where(
                ControlVersion.control_id == control.id
            )
        )
        .scalar_one_or_none()
        or 0
    ) + 1

    control_version = ControlVersion(
        organisation_id=organisation_id,
        control_id=control.id,
        version=next_version,
        control_code=payload.control_code,
        title=payload.title,
        description=payload.description,
        framework=payload.framework,
        status=payload.status,
        owner_user_id=payload.owner_user_id,
        created_by_user_id=actor_user.id,
    )
    db.add(control_version)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="control.version_created",
        entity_type="control_version",
        entity_id=control_version.id,
        metadata={"control_id": str(control.id), "version": next_version},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(control)
    db.refresh(control_version)
    return _control_out_from_latest(control, control_version)


@router.get(
    "/organisations/{organisation_id}/controls/{control_id}/versions",
    response_model=list[ControlVersionOut],
)
def list_control_versions(
    organisation_id: UUID,
    control_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> list[ControlVersionOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    _require_control_for_org(db, organisation_id, control_id)

    versions = (
        db.execute(
            select(ControlVersion)
            .where(
                ControlVersion.organisation_id == organisation_id,
                ControlVersion.control_id == control_id,
            )
            .order_by(ControlVersion.version.desc())
        )
        .scalars()
        .all()
    )

    return list(versions)


@router.post(
    "/organisations/{organisation_id}/controls/{control_id}/evidence",
    response_model=ControlEvidenceLinkOut,
)
def link_control_evidence(
    organisation_id: UUID,
    control_id: UUID,
    payload: ControlEvidenceLinkCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_CONTROLS)),
) -> ControlEvidenceLinkOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    control = _require_control_for_org(db, organisation_id, control_id)
    evidence = _require_evidence_for_org(
        db, organisation_id, payload.evidence_item_id
    )
    link = ControlEvidenceLink(
        organisation_id=organisation_id,
        control_id=control.id,
        evidence_item_id=evidence.id,
        created_by_user_id=actor_user.id,
    )
    db.add(link)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="control.evidence_linked",
        entity_type="control_evidence_link",
        entity_id=link.id,
        metadata={
            "control_id": str(control.id),
            "evidence_item_id": str(evidence.id),
        },
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(link)
    return ControlEvidenceLinkOut(
        id=link.id,
        control_id=link.control_id,
        evidence_item_id=link.evidence_item_id,
        created_at=link.created_at,
    )
