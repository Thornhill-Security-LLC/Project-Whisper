import hashlib
import os
import tempfile
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditEvent, EvidenceItem, Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_evidence_file_upload_and_download() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Evidence Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="evidence-uploader@example.com",
                display_name="Evidence Uploader",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
    except Exception:
        pytest.skip("Database is unavailable.")

    file_bytes = b"hello evidence"
    expected_sha256 = hashlib.sha256(file_bytes).hexdigest()

    with tempfile.TemporaryDirectory() as temp_dir:
        previous_root = os.getenv("EVIDENCE_LOCAL_ROOT")
        os.environ["EVIDENCE_LOCAL_ROOT"] = temp_dir
        try:
            response = client.post(
                f"/api/organisations/{organisation.id}/evidence/upload",
                data={
                    "evidence_type": "policy",
                    "title": "Security Policy",
                },
                files={"file": ("policy.txt", file_bytes, "text/plain")},
                headers={
                    "X-Organisation-Id": str(organisation.id),
                    "X-Actor-User-Id": str(actor_user.id),
                },
            )
            if response.status_code == 500:
                pytest.skip("Database is unavailable.")

            assert response.status_code == 200
            payload = response.json()
            evidence_id = UUID(payload["id"])

            with SessionLocal() as session:
                evidence = session.get(EvidenceItem, evidence_id)
                events = session.execute(
                    select(AuditEvent).where(
                        AuditEvent.entity_id == evidence_id,
                        AuditEvent.action == "evidence_item.uploaded",
                    )
                ).scalars().all()

            assert evidence is not None
            assert evidence.storage_backend == "local"
            assert evidence.object_key
            assert evidence.sha256 == expected_sha256
            assert evidence.size_bytes == len(file_bytes)
            assert evidence.original_filename == "policy.txt"
            assert evidence.content_type == "text/plain"
            assert evidence.uploaded_at is not None
            assert events
            assert all(event.actor_user_id == actor_user.id for event in events)

            download_response = client.get(
                f"/api/organisations/{organisation.id}/evidence/{evidence_id}/download",
                headers={
                    "X-Organisation-Id": str(organisation.id),
                    "X-Actor-User-Id": str(actor_user.id),
                },
            )

            if download_response.status_code == 500:
                pytest.skip("Database is unavailable.")

            assert download_response.status_code == 200
            assert download_response.content == file_bytes
        finally:
            if previous_root is None:
                del os.environ["EVIDENCE_LOCAL_ROOT"]
            else:
                os.environ["EVIDENCE_LOCAL_ROOT"] = previous_root
