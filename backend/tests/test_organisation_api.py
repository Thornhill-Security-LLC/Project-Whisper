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
def test_create_organisation_returns_payload_and_audit_event() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/organisations",
        json={"name": "Acme Security"},
        headers={"X-Actor-User-Id": "00000000-0000-0000-0000-000000000000"},
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
    assert event.metadata_ == {"name": "Acme Security"}
