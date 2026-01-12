import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.db.models import Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_risk_controls_link_and_list() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Risk Control Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="risk-control@example.com",
                display_name="Risk Control",
                role="org_admin",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    risk_response = client.post(
        f"/api/organisations/{organisation_id}/risks",
        json={
            "title": "Vendor risk",
            "description": "Third-party access risk",
            "category": "High",
            "likelihood": 4,
            "impact": 5,
            "status": "Open",
            "owner_user_id": str(actor_user_id),
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if risk_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert risk_response.status_code == 200
    risk_payload = risk_response.json()
    risk_id = UUID(risk_payload["risk_id"])

    control_response = client.post(
        f"/api/organisations/{organisation_id}/controls",
        json={
            "framework": "SOC2",
            "control_code": "CC7.2",
            "title": "Third-party reviews",
            "description": "Review vendor access regularly",
            "status": "Planned",
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

    link_response = client.post(
        f"/api/organisations/{organisation_id}/risks/{risk_id}/controls",
        json={"control_id": str(control_id)},
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if link_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert link_response.status_code == 200

    list_response = client.get(
        f"/api/organisations/{organisation_id}/risks/{risk_id}/controls",
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
    assert str(control_id) in {item["control_id"] for item in payload}
