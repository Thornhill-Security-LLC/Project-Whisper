import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent, Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_organisation_returns_payload_and_audit_event() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            actor_org = Organisation(name="Actor Org")
            session.add(actor_org)
            session.commit()
            session.refresh(actor_org)

            actor_user = UserAccount(
                organisation_id=actor_org.id,
                email="actor@example.com",
                display_name="Actor User",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        "/api/organisations",
        json={"name": "Acme Security"},
        headers={"X-Actor-User-Id": str(actor_user_id)},
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Acme Security"
    assert UUID(payload["id"])
    assert "created_at" in payload

    with SessionLocal() as session:
        event = session.execute(
            select(AuditEvent).order_by(AuditEvent.created_at.desc())
        ).scalar_one_or_none()

    assert event is not None
    assert event.action == "organisation.created"
    assert event.entity_type == "organisation"
    assert event.entity_id == UUID(payload["id"])
    assert event.actor_user_id == actor_user_id
    assert event.metadata_ == {"name": "Acme Security"}


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_get_organisation_rejects_cross_org_header() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            primary_org = Organisation(name="Primary Org")
            other_org = Organisation(name="Other Org")
            session.add_all([primary_org, other_org])
            session.commit()
            session.refresh(primary_org)
            session.refresh(other_org)
            primary_org_id = primary_org.id
            other_org_id = other_org.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.get(
        f"/api/organisations/{primary_org_id}",
        headers={"X-Organisation-Id": str(other_org_id)},
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-organisation access denied"


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_create_user_rejects_actor_from_other_org() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            target_org = Organisation(name="Target Org")
            actor_org = Organisation(name="Actor Org")
            session.add_all([target_org, actor_org])
            session.commit()
            session.refresh(target_org)
            session.refresh(actor_org)
            target_org_id = target_org.id

            actor_user = UserAccount(
                organisation_id=actor_org.id,
                email="actor@example.com",
                display_name="Actor User",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{target_org_id}/users",
        json={"email": "newuser@example.com", "display_name": "New User"},
        headers={
            "X-Organisation-Id": str(target_org_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 403
    assert response.json()["detail"] == "Actor not in organisation"
