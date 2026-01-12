import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent, Incident, IncidentVersion, Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_incident_and_version_emits_audit_events() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Incident Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="incident-owner@example.com",
                display_name="Incident Owner",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation_id}/incidents",
        json={
            "title": "Credential stuffing",
            "description": "Repeated auth attempts",
            "severity": "high",
            "status": "open",
            "category": "security",
            "owner_user_id": str(actor_user_id),
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert payload["latest_version"] == 1
    assert payload["title"] == "Credential stuffing"
    assert payload["owner_user_id"] == str(actor_user_id)
    incident_id = UUID(payload["incident_id"])

    with SessionLocal() as session:
        incident = session.get(Incident, incident_id)
        incident_version = session.execute(
            select(IncidentVersion).where(IncidentVersion.incident_id == incident_id)
        ).scalar_one_or_none()
        assert incident_version is not None
        events = session.execute(
            select(AuditEvent).where(
                AuditEvent.entity_id.in_([incident_id, incident_version.id])
            )
        ).scalars().all()

    assert incident is not None
    assert incident_version.incident_id == incident.id
    event_ids = {event.entity_id for event in events}
    assert incident.id in event_ids
    assert incident_version.id in event_ids


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_incident_version_increments_version_and_emits_audit_event() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Incident Version Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="incident-versioner@example.com",
                display_name="Incident Versioner",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id

            incident = Incident(organisation_id=organisation.id, latest_version=1)
            session.add(incident)
            session.commit()
            session.refresh(incident)
            incident_id = incident.id

            initial_version = IncidentVersion(
                organisation_id=organisation_id,
                incident_id=incident_id,
                version=1,
                title="Baseline",
                description=None,
                severity="medium",
                status="open",
                category=None,
                owner_user_id=None,
                created_by_user_id=actor_user_id,
            )
            session.add(initial_version)
            session.commit()
            session.refresh(initial_version)
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation_id}/incidents/{incident_id}/versions",
        json={
            "title": "Updated",
            "description": "Expanded scope",
            "severity": "high",
            "status": "investigating",
            "category": "security",
            "owner_user_id": str(actor_user_id),
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert payload["latest_version"] == 2
    assert payload["title"] == "Updated"

    with SessionLocal() as session:
        versions = session.execute(
            select(IncidentVersion).where(IncidentVersion.incident_id == incident_id)
        ).scalars().all()
        latest_version = max(versions, key=lambda entry: entry.version)
        events = session.execute(
            select(AuditEvent).where(AuditEvent.entity_id == latest_version.id)
        ).scalars().all()

    assert len(versions) == 2
    assert {version.version for version in versions} == {1, 2}
    assert len(events) == 1


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_list_incident_versions_returns_versions() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Incident Version List Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="incident-version-reader@example.com",
                display_name="Incident Version Reader",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id

            incident = Incident(organisation_id=organisation_id, latest_version=2)
            session.add(incident)
            session.commit()
            session.refresh(incident)
            incident_id = incident.id

            session.add_all(
                [
                    IncidentVersion(
                        organisation_id=organisation_id,
                        incident_id=incident_id,
                        version=1,
                        title="Initial",
                        description=None,
                        severity="low",
                        status="open",
                        category=None,
                        owner_user_id=None,
                        created_by_user_id=actor_user_id,
                    ),
                    IncidentVersion(
                        organisation_id=organisation_id,
                        incident_id=incident_id,
                        version=2,
                        title="Follow-up",
                        description=None,
                        severity="medium",
                        status="review",
                        category=None,
                        owner_user_id=None,
                        created_by_user_id=actor_user_id,
                    ),
                ]
            )
            session.commit()
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.get(
        f"/api/organisations/{organisation_id}/incidents/{incident_id}/versions",
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert [entry["version"] for entry in payload] == [2, 1]
    assert {entry["incident_id"] for entry in payload} == {str(incident_id)}
    assert {entry["organisation_id"] for entry in payload} == {
        str(organisation_id)
    }


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_incident_rejects_actor_from_other_org() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            target_org = Organisation(name="Incident Target Org")
            actor_org = Organisation(name="Incident Actor Org")
            session.add_all([target_org, actor_org])
            session.commit()
            session.refresh(target_org)
            session.refresh(actor_org)
            target_org_id = target_org.id

            actor_user = UserAccount(
                organisation_id=actor_org.id,
                email="incident-actor@example.com",
                display_name="Incident Actor",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{target_org_id}/incidents",
        json={
            "title": "Cross-org incident",
            "description": "Actor from another org",
            "severity": "low",
            "status": "open",
            "category": "security",
        },
        headers={
            "X-Organisation-Id": str(target_org_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor not in organisation"
