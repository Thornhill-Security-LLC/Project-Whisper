import os

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db() -> None:
    if os.getenv("RUN_DB_TESTS") != "1":
        pytest.skip("Database tests are disabled.")

    client = TestClient(app)
    response = client.get("/health/db")

    if response.status_code == 500:
        pytest.skip("Database is unavailable.")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
