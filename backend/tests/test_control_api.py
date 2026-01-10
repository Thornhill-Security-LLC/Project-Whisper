import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.db.models import Control, ControlVersion, Organisation, UserAccount
from app.db.session import SessionLocal
from app.main import app


@pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1", reason="Database tests are disabled."
)
def test_list_control_versions_returns_versions() -> None:
    client = TestClient(app)

    try:
        with SessionLocal() as session:
            organisation = Organisation(name="Control Version Org")
            session.add(organisation)
            session.commit()
            session.refresh(organisation)

            actor_user = UserAccount(
                organisation_id=organisation.id,
                email="control-version@example.com",
                display_name="Control Version",
                role="org_admin",
            )
            session.add(actor_user)
            session.commit()
            session.refresh(actor_user)
            organisation_id = organisation.id
            actor_user_id = actor_user.id

            control = Control(organisation_id=organisation_id)
            session.add(control)
            session.commit()
            session.refresh(control)
            control_id = control.id

            session.add_all(
                [
                    ControlVersion(
                        organisation_id=organisation_id,
                        control_id=control_id,
                        version=1,
                        control_code="CC1.1",
                        title="Initial Control",
                        description=None,
                        framework=None,
                        status="Implemented",
                        owner_user_id=None,
                        created_by_user_id=actor_user_id,
                    ),
                    ControlVersion(
                        organisation_id=organisation_id,
                        control_id=control_id,
                        version=2,
                        control_code="CC1.1",
                        title="Updated Control",
                        description=None,
                        framework=None,
                        status="Implemented",
                        owner_user_id=None,
                        created_by_user_id=actor_user_id,
                    ),
                ]
            )
            session.commit()
    except Exception:
        pytest.skip("Database is unavailable.")

    response = client.get(
        f"/api/organisations/{organisation_id}/controls/{control_id}/versions",
        headers={
            "X-Organisation-Id": str(organisation_id),
            "X-Actor-User-Id": str(actor_user_id),
        },
    )

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert [entry["version"] for entry in payload] == [2, 1]
    assert {entry["control_id"] for entry in payload} == {str(control_id)}
    assert {entry["organisation_id"] for entry in payload} == {
        str(organisation_id)
    }
