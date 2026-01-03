from app.main import app


def test_openapi_includes_api_routes() -> None:
    schema = app.openapi()
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
