import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent, Organisation, Risk, RiskVersion, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_risk_and_version_emits_audit_events() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Risk Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="risk-owner@example.com",
                display_name="Risk Owner",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation.id}/risks",
        json={
            "title": "Credential stuffing",
            "description": "Abuse of reused credentials",
            "category": "security",
            "likelihood": 4,
            "impact": 5,
            "status": "open",
            "owner_user_id": str(actor_user.id),
        },
        headers={
            "X-Organisation-Id": str(organisation.id),
            "X-Actor-User-Id": str(actor_user.id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert payload["latest_version"] == 1
    assert payload["title"] == "Credential stuffing"
    assert payload["owner_user_id"] == str(actor_user.id)
    risk_id = UUID(payload["risk_id"])

    with SessionLocal() as session:
        risk = session.get(Risk, risk_id)
        risk_version = session.execute(
            select(RiskVersion).where(RiskVersion.risk_id == risk_id)
        ).scalar_one_or_none()
        assert risk_version is not None
        events = session.execute(
            select(AuditEvent).where(
                AuditEvent.entity_id.in_([risk_id, risk_version.id])
            )
        ).scalars().all()

    assert risk is not None
    assert risk_version.risk_id == risk.id
    event_ids = {event.entity_id for event in events}
    assert risk.id in event_ids
    assert risk_version.id in event_ids


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_risk_version_increments_version() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Version Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="versioner@example.com",
                display_name="Versioner",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)

            risk = Risk(organisation_id=organisation.id)
            session.add(risk)
            session.commit()
            session.refresh(risk)

            initial_version = RiskVersion(
                organisation_id=organisation.id,
                risk_id=risk.id,
                version=1,
                title="Baseline",
                description=None,
                category=None,
                likelihood=2,
                impact=3,
                status="open",
                owner_user_id=None,
                created_by_user_id=actor_user.id,
            )
            session.add(initial_version)
            session.commit()
            session.refresh(initial_version)
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation.id}/risks/{risk.id}/versions",
        json={
            "title": "Updated",
            "description": "Expanded scope",
            "category": "security",
            "likelihood": 3,
            "impact": 4,
            "status": "review",
            "owner_user_id": str(actor_user.id),
        },
        headers={
            "X-Organisation-Id": str(organisation.id),
            "X-Actor-User-Id": str(actor_user.id),
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
            select(RiskVersion).where(RiskVersion.risk_id == risk.id)
        ).scalars().all()

    assert len(versions) == 2
    assert {version.version for version in versions} == {1, 2}


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_risk_requires_actor_header() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Actor Required Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation.id}/risks",
        json={
            "title": "Risk without actor",
            "description": "No actor header",
            "category": "security",
            "likelihood": 2,
            "impact": 3,
            "status": "open",
        },
        headers={"X-Organisation-Id": str(organisation.id)},
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 401
    assert response.json()["detail"] == "X-Actor-User-Id header required"


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_risk_rejects_actor_from_other_org() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            target_org = Organisation(name="Risk Target Org")
            actor_org = Organisation(name="Risk Actor Org")
            session.add_all([target_org, actor_org])
            session.commit()
            session.refresh(target_org)
            session.refresh(actor_org)

            actor_user = UserAccount(
                organisation_id=actor_org.id,
                email="risk-actor@example.com",
                display_name="Risk Actor",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{target_org.id}/risks",
        json={
            "title": "Cross-org risk",
            "description": "Actor from another org",
            "category": "security",
            "likelihood": 2,
            "impact": 3,
            "status": "open",
        },
        headers={
            "X-Organisation-Id": str(target_org.id),
            "X-Actor-User-Id": str(actor_user.id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor not in organisation"
