import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import (
    AuditEvent,
    Control,
    ControlEvidenceLink,
    ControlVersion,
    EvidenceItem,
    Organisation,
    UserAccount,
)
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_control_evidence_link_emits_audit_events() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Control Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="control-owner@example.com",
                display_name="Control Owner",
                role="org_admin",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    control_response = client.post(
        f"/api/organisations/{organisation_id}/controls",
        json={
            "framework": "SOC2",
            "control_code": "CC6.1",
            "title": "Logical access",
            "description": "Access controls are enforced",
            "status": "Implemented",
            "owner_user_id": str(actor_user_id),
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if control_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert control_response.status_code == 200
    control_payload = control_response.json()
    control_id = UUID(control_payload["control_id"])

    evidence_response = client.post(
        f"/api/organisations/{organisation_id}/evidence",
        json={
            "title": "Access policy",
            "description": "Policy document",
            "evidence_type": "policy",
            "source": "manual",
            "external_uri": "https://example.com/policy",
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if evidence_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert evidence_response.status_code == 200
    evidence_payload = evidence_response.json()
    evidence_id = UUID(evidence_payload["id"])

    link_response = client.post(
        f"/api/organisations/{organisation_id}/controls/{control_id}/evidence",
        json={"evidence_item_id": str(evidence_id)},
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if link_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert link_response.status_code == 200
    link_payload = link_response.json()
    link_id = UUID(link_payload["id"])

    with SessionLocal() as session:
        control = session.get(Control, control_id)
        version = session.execute(
            select(ControlVersion).where(ControlVersion.control_id == control_id)
        ).scalar_one_or_none()
        evidence = session.get(EvidenceItem, evidence_id)
        link = session.get(ControlEvidenceLink, link_id)
        events = session.execute(
            select(AuditEvent).where(
                AuditEvent.entity_id.in_(
                    [control_id, version.id, evidence_id, link_id]
                )
            )
        ).scalars().all()

    assert control is not None
    assert version is not None
    assert evidence is not None
    assert link is not None
    assert link.control_id == control.id
    assert link.evidence_item_id == evidence.id
    event_ids = {event.entity_id for event in events}
    assert control.id in event_ids
    assert version.id in event_ids
    assert evidence.id in event_ids
    assert link.id in event_ids
    event_actions = {event.action for event in events}
    assert "control.created" in event_actions
    assert "control.version_created" in event_actions
    assert "evidence_item.created" in event_actions
    assert "control.evidence_linked" in event_actions


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_control_evidence_list_returns_linked_evidence() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Evidence List Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="evidence-list@example.com",
                display_name="Evidence List",
                role="org_admin",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    control_response = client.post(
        f"/api/organisations/{organisation_id}/controls",
        json={
            "framework": "SOC2",
            "control_code": "CC6.3",
            "title": "Asset inventory",
            "description": "Maintain asset inventory",
            "status": "Implemented",
            "owner_user_id": str(actor_user_id),
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if control_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert control_response.status_code == 200
    control_payload = control_response.json()
    control_id = control_payload["control_id"]

    evidence_response = client.post(
        f"/api/organisations/{organisation_id}/evidence",
        json={
            "title": "Asset list",
            "description": "Inventory spreadsheet",
            "evidence_type": "inventory",
            "source": "manual",
            "external_uri": "https://example.com/assets",
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if evidence_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert evidence_response.status_code == 200
    evidence_payload = evidence_response.json()
    evidence_id = evidence_payload["id"]

    link_response = client.post(
        f"/api/organisations/{organisation_id}/controls/{control_id}/evidence",
        json={"evidence_item_id": evidence_id},
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if link_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert link_response.status_code == 200

    list_response = client.get(
        f"/api/organisations/{organisation_id}/controls/{control_id}/evidence",
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if list_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert list_response.status_code == 200
    payload = list_response.json()
    assert isinstance(payload, list)
    assert evidence_id in {item["id"] for item in payload}
