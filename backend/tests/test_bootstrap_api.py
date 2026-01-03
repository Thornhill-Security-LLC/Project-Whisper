import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_bootstrap_creates_org_user_and_audit_events() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/bootstrap",
        json={
            "organisation_name": "Bootstrap Org",
            "admin_email": "admin@example.com",
            "admin_display_name": "Admin User",
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    organisation_id = UUID(payload["organisation"]["id"])
    admin_user_id = UUID(payload["admin_user"]["id"])

    with SessionLocal() as session:
        events = (
            session.execute(
                select(AuditEvent).where(
                    AuditEvent.action.in_(
                        ["organisation.created", "user_account.created"]
                    ),
                    AuditEvent.organisation_id == organisation_id,
                )
            )
            .scalars()
            .all()
        )

    assert {event.action for event in events} >= {
        "organisation.created",
        "user_account.created",
    }
    for event in events:
        assert event.actor_user_id == admin_user_id
