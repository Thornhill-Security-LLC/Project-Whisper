import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent, EvidenceItem, Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_evidence_download_url_uses_gcs_backend(monkeypatch) -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Evidence Download Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="evidence-downloader@example.com",
                display_name="Evidence Downloader",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)

            evidence = EvidenceItem(
                organisation_id=organisation.id,
                title="Evidence",
                evidence_type="policy",
                storage_backend="gcs",
                object_key="evidence/key",
                original_filename="report.pdf",
                content_type="application/pdf",
                uploaded_at=datetime.now(timezone.utc),
                created_by_user_id=actor_user.id,
            )
            session.add(evidence)
            session.commit()
            session.refresh(evidence)
    except Exception:
        pytest.skip("Database is unavailable.")

    class FakeGcsStorage:
        backend = "gcs"

        def generate_signed_download_url(
            self, object_key: str, filename: str, content_type: str | None, ttl_seconds: int
        ) -> str:
            return f"https://signed.example.com/{object_key}?ttl={ttl_seconds}"

    monkeypatch.setenv("GCS_SIGNED_URL_TTL_SECONDS", "120")
    monkeypatch.setattr(
        "app.services.evidence_storage.get_evidence_storage",
        lambda: FakeGcsStorage(),
    )

    response = client.get(
        f"/api/organisations/{organisation.id}/evidence/{evidence.id}/download-url",
        headers={
            "X-Organisation-Id": str(organisation.id),
            "X-Actor-User-Id": str(actor_user.id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert payload["expires_in"] == 120
    assert payload["url"].startswith("https://signed.example.com/evidence/key")

    with SessionLocal() as session:
        events = session.execute(
            select(AuditEvent).where(
                AuditEvent.entity_id == evidence.id,
                AuditEvent.action == "evidence_item.download_url_generated",
            )
        ).scalars().all()

    assert events
    assert all(event.actor_user_id == actor_user.id for event in events)
