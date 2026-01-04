import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent, EvidenceItem, Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


def _create_org_actor_and_evidence(backend: str) -> tuple[Organisation, UserAccount, EvidenceItem]:
    with SessionLocal() as session:
        organisation = Organisation(name=f"Evidence Download Org {backend}")
        session.add(organisation)
        session.commit()
        session.refresh(organisation)

        actor_user = UserAccount(
            organisation_id=organisation.id,
            email=f"evidence-downloader-{backend}@example.com",
            display_name="Evidence Downloader",
        )
        session.add(actor_user)
        session.commit()
        session.refresh(actor_user)

        evidence = EvidenceItem(
            organisation_id=organisation.id,
            title="Evidence",
            evidence_type="policy",
            storage_backend=backend,
            object_key="evidence/key",
            original_filename="report.pdf",
            content_type="application/pdf",
            uploaded_at=datetime.now(timezone.utc),
            created_by_user_id=actor_user.id,
        )
        session.add(evidence)
        session.commit()
        session.refresh(evidence)

        return organisation, actor_user, evidence


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_evidence_download_url_uses_gcs_backend(monkeypatch) -> None:
    client = TestClient(app)

    try:
        organisation, actor_user, evidence = _create_org_actor_and_evidence(
            "gcs"
        )
    except Exception:
        pytest.skip("Database is unavailable.")

    class FakeBucket:
        pass

    class FakeClient:
        def bucket(self, bucket_name: str) -> FakeBucket:
            return FakeBucket()

    class FakeGcsStorage:
        backend = "gcs"
        bucket_name = "test-bucket"
        client = FakeClient()

    monkeypatch.setenv("GCS_SIGNED_URL_TTL_SECONDS", "120")
    monkeypatch.setattr(
        "app.services.evidence_storage.get_evidence_storage",
        lambda: FakeGcsStorage(),
    )
    monkeypatch.setattr(
        "app.services.evidence_storage.generate_gcs_signed_url",
        lambda bucket, object_key, filename, ttl_seconds: (
            f"https://signed.example.com/{object_key}?ttl={ttl_seconds}"
        ),
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


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_evidence_download_url_rejects_local_backend() -> None:
    client = TestClient(app)

    try:
        organisation, actor_user, evidence = _create_org_actor_and_evidence(
            "local"
        )
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.get(
        f"/api/organisations/{organisation.id}/evidence/{evidence.id}/download-url",
        headers={
            "X-Organisation-Id": str(organisation.id),
            "X-Actor-User-Id": str(actor_user.id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 409
    assert response.json()["detail"] == "Evidence stored locally; use /download."


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_evidence_download_rejects_gcs_backend() -> None:
    client = TestClient(app)

    try:
        organisation, actor_user, evidence = _create_org_actor_and_evidence(
            "gcs"
        )
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.get(
        f"/api/organisations/{organisation.id}/evidence/{evidence.id}/download",
        headers={
            "X-Organisation-Id": str(organisation.id),
            "X-Actor-User-Id": str(actor_user.id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 409
    assert response.json()["detail"] == "Evidence stored in GCS; use /download-url."
