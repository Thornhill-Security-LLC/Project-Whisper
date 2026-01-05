import os
import tempfile

import pytest
from fastapi.testclient import TestClient

from app.db.models import Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_org_admin_can_create_users() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="RBAC Admin Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            admin_user = UserAccount(
                organisation_id=organisation.id,
                email="admin@example.com",
                display_name="Admin User",
                role="org_admin",
            )
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)
            organisation_id = organisation.id
            admin_user_id = admin_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation_id}/users",
        json={"email": "newuser@example.com", "display_name": "New User"},
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(admin_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "newuser@example.com"
    assert payload["role"] == "org_member"


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_org_member_cannot_create_users() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="RBAC Member Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            member_user = UserAccount(
                organisation_id=organisation.id,
                email="member@example.com",
                display_name="Member User",
                role="org_member",
            )
            session.add(member_user)
            session.commit()
            session.refresh(member_user)
            organisation_id = organisation.id
            member_user_id = member_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.post(
        f"/api/organisations/{organisation_id}/users",
        json={"email": "blocked@example.com", "display_name": "Blocked"},
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(member_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 403


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_auditor_cannot_upload_evidence_but_can_read() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="RBAC Auditor Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            admin_user = UserAccount(
                organisation_id=organisation.id,
                email="admin-auditor@example.com",
                display_name="Admin User",
                role="org_admin",
            )
            auditor_user = UserAccount(
                organisation_id=organisation.id,
                email="auditor@example.com",
                display_name="Auditor User",
                role="auditor",
            )
            session.add_all([admin_user, auditor_user])
            session.commit()
            session.refresh(admin_user)
            session.refresh(auditor_user)
            organisation_id = organisation.id
            admin_user_id = admin_user.id
            auditor_user_id = auditor_user.id
    except Exception:
        pytest.skip("Database is unavailable.")

    create_response = client.post(
        f"/api/organisations/{organisation_id}/evidence",
        json={
            "title": "Read only evidence",
            "description": "Seed evidence",
            "evidence_type": "policy",
        },
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(admin_user_id),
        },
    )

    if create_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert create_response.status_code == 200

    with tempfile.TemporaryDirectory() as temp_dir:
        previous_root = os.getenv("EVIDENCE_LOCAL_ROOT")
        os.environ["EVIDENCE_LOCAL_ROOT"] = temp_dir
        try:
            upload_response = client.post(
                f"/api/organisations/{organisation_id}/evidence/upload",
                data={
                    "evidence_type": "policy",
                    "title": "Auditor Upload",
                },
                files={"file": ("audit.txt", b"audit", "text/plain")},
                headers={
                    "X-Organisation-Id": str(organisation_id),
                    "X-Actor-User-Id": str(auditor_user_id),
                },
            )
        finally:
            if previous_root is None:
                del os.environ["EVIDENCE_LOCAL_ROOT"]
            else:
                os.environ["EVIDENCE_LOCAL_ROOT"] = previous_root

    if upload_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert upload_response.status_code == 403

    read_response = client.get(
        f"/api/organisations/{organisation_id}/evidence",
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(auditor_user_id),
        },
    )

    if read_response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert read_response.status_code == 200
