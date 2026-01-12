from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_actor
from app.core.authorization import ORG_MANAGE_INCIDENTS, ORG_READ, require_permission
from app.core.tenant import assert_path_matches_tenant, require_tenant_context
from app.db.models import Incident, IncidentVersion, Organisation, UserAccount
from app.db.session import get_db
from app.schemas.incident import (
    IncidentCreate,
    IncidentOut,
    IncidentVersionCreate,
    IncidentVersionOut,
)
from app.services.audit import emit_audit_event

router = APIRouter(tags=["incidents"])


def _require_incident_for_org(
    db: Session, organisation_id: UUID, incident_id: UUID
) -> Incident:
    incident = (
        db.execute(
            select(Incident).where(
                Incident.id == incident_id,
                Incident.organisation_id == organisation_id,
            )
        )
        .scalars()
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


def _require_owner_user(
    db: Session, organisation_id: UUID, owner_user_id: UUID
) -> None:
    owner_user = db.get(UserAccount, owner_user_id)
    if owner_user is None or owner_user.organisation_id != organisation_id:
        raise HTTPException(
            status_code=400, detail="Owner user must belong to organisation"
        )


def _incident_out_from_latest(
    incident: Incident, version: IncidentVersion
) -> IncidentOut:
    return IncidentOut(
        incident_id=incident.id,
        organisation_id=incident.organisation_id,
        latest_version=incident.latest_version,
        title=version.title,
        description=version.description,
        severity=version.severity,
        status=version.status,
        category=version.category,
        owner_user_id=version.owner_user_id,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
    )


@router.post(
    "/organisations/{organisation_id}/incidents",
    response_model=IncidentOut,
)
def create_incident(
    organisation_id: UUID,
    payload: IncidentCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_INCIDENTS)),
) -> IncidentOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    organisation = db.get(Organisation, organisation_id)
    if not organisation:
        raise HTTPException(status_code=404, detail="Organisation not found")

    if payload.owner_user_id is not None:
        _require_owner_user(db, organisation_id, payload.owner_user_id)

    incident = Incident(organisation_id=organisation_id, latest_version=1)
    incident.updated_at = datetime.now(timezone.utc)
    db.add(incident)
    db.flush()

    incident_version = IncidentVersion(
        organisation_id=organisation_id,
        incident_id=incident.id,
        version=1,
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        status=payload.status,
        category=payload.category,
        owner_user_id=payload.owner_user_id,
        created_by_user_id=actor_user.id,
    )
    db.add(incident_version)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="incident.created",
        entity_type="incident",
        entity_id=incident.id,
        metadata={
            "title": payload.title,
            "severity": payload.severity,
            "status": payload.status,
        },
    )
    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="incident.version_created",
        entity_type="incident_version",
        entity_id=incident_version.id,
        metadata={"incident_id": str(incident.id), "version": 1},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(incident)
    db.refresh(incident_version)
    return _incident_out_from_latest(incident, incident_version)


@router.get(
    "/organisations/{organisation_id}/incidents",
    response_model=list[IncidentOut],
)
def list_incidents(
    organisation_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> list[IncidentOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    rows = db.execute(
        select(Incident, IncidentVersion)
        .join(
            IncidentVersion,
            (IncidentVersion.incident_id == Incident.id)
            & (IncidentVersion.version == Incident.latest_version),
        )
        .where(Incident.organisation_id == organisation_id)
    ).all()

    return [_incident_out_from_latest(incident, version) for incident, version in rows]


@router.get(
    "/organisations/{organisation_id}/incidents/{incident_id}",
    response_model=IncidentOut,
)
def get_incident(
    organisation_id: UUID,
    incident_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> IncidentOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    incident = _require_incident_for_org(db, organisation_id, incident_id)

    version = (
        db.execute(
            select(IncidentVersion).where(
                IncidentVersion.incident_id == incident.id,
                IncidentVersion.version == incident.latest_version,
            )
        )
        .scalars()
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Incident version not found")

    return _incident_out_from_latest(incident, version)


@router.post(
    "/organisations/{organisation_id}/incidents/{incident_id}/versions",
    response_model=IncidentOut,
)
def create_incident_version(
    organisation_id: UUID,
    incident_id: UUID,
    payload: IncidentVersionCreate,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor: dict[str, UUID | str | None] = Depends(get_actor),
    actor_user: UserAccount = Depends(require_permission(ORG_MANAGE_INCIDENTS)),
) -> IncidentOut:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    incident = (
        db.execute(
            select(Incident)
            .where(
                Incident.id == incident_id,
                Incident.organisation_id == organisation_id,
            )
            .with_for_update()
        )
        .scalars()
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if payload.owner_user_id is not None:
        _require_owner_user(db, organisation_id, payload.owner_user_id)

    next_version = (incident.latest_version or 0) + 1

    incident_version = IncidentVersion(
        organisation_id=organisation_id,
        incident_id=incident.id,
        version=next_version,
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        status=payload.status,
        category=payload.category,
        owner_user_id=payload.owner_user_id,
        created_by_user_id=actor_user.id,
    )
    db.add(incident_version)

    incident.latest_version = next_version
    incident.updated_at = datetime.now(timezone.utc)

    emit_audit_event(
        db,
        organisation_id=organisation_id,
        actor_user_id=actor_user.id,
        actor_email=actor.get("actor_email"),
        action="incident.version_created",
        entity_type="incident_version",
        entity_id=incident_version.id,
        metadata={"incident_id": str(incident.id), "version": next_version},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Write failed")

    db.refresh(incident)
    db.refresh(incident_version)
    return _incident_out_from_latest(incident, incident_version)


@router.get(
    "/organisations/{organisation_id}/incidents/{incident_id}/versions",
    response_model=list[IncidentVersionOut],
)
def list_incident_versions(
    organisation_id: UUID,
    incident_id: UUID,
    tenant_org_id: UUID = Depends(require_tenant_context),
    db: Session = Depends(get_db),
    actor_user: UserAccount = Depends(require_permission(ORG_READ)),
) -> list[IncidentVersionOut]:
    assert_path_matches_tenant(organisation_id, tenant_org_id)

    _require_incident_for_org(db, organisation_id, incident_id)

    versions = (
        db.execute(
            select(IncidentVersion)
            .where(
                IncidentVersion.organisation_id == organisation_id,
                IncidentVersion.incident_id == incident_id,
            )
            .order_by(IncidentVersion.version.desc())
        )
        .scalars()
        .all()
    )

    return list(versions)
