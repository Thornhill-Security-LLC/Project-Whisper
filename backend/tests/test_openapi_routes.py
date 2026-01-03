from fastapi.testclient import TestClient

from app.main import app


def test_openapi_includes_api_routes() -> None:
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "/api/organisations" in schema["paths"]
    assert "/api/organisations/{organisation_id}" in schema["paths"]
    assert "/api/organisations/{organisation_id}/users" in schema["paths"]
    assert "/api/organisations/{organisation_id}/risks" in schema["paths"]
    assert (
        "/api/organisations/{organisation_id}/risks/{risk_id}"
        in schema["paths"]
    )
    assert (
        "/api/organisations/{organisation_id}/risks/{risk_id}/versions"
        in schema["paths"]
    )
    assert "/api/organisations/{organisation_id}/controls" in schema["paths"]
    assert (
        "/api/organisations/{organisation_id}/controls/{control_id}"
        in schema["paths"]
    )
    assert (
        "/api/organisations/{organisation_id}/controls/{control_id}/versions"
        in schema["paths"]
    )
    assert (
        "/api/organisations/{organisation_id}/controls/{control_id}/evidence"
        in schema["paths"]
    )
    assert "/api/organisations/{organisation_id}/evidence" in schema["paths"]
    assert (
        "/api/organisations/{organisation_id}/evidence/upload"
        in schema["paths"]
    )
    assert (
        "/api/organisations/{organisation_id}/evidence/{evidence_id}/download"
        in schema["paths"]
    )
    assert (
        "/api/organisations/{organisation_id}/evidence/{evidence_id}/download-url"
        in schema["paths"]
    )
