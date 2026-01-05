import base64
import time
from uuid import uuid4

import jwt
from fastapi.testclient import TestClient

from app.core.auth import oidc
from app.db.session import get_db
from app.main import app


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _build_hs256_token(secret: bytes, issuer: str, audience: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": "user-subject",
            "email": "user@example.com",
            "iss": issuer,
            "aud": audience,
            "nbf": now - 5,
            "exp": now + 60,
        },
        secret,
        algorithm="HS256",
        headers={"kid": "test-key"},
    )


def _override_db() -> object:
    return object()


def test_dev_mode_uses_headers(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "dev")
    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    actor_id = str(uuid4())
    org_id = str(uuid4())

    response = client.get(
        "/api/auth/whoami",
        headers={
            "X-Organisation-Id": org_id,
            "X-Actor-User-Id": actor_id,
            "X-Actor-Email": "dev@example.com",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["auth_mode"] == "dev"
    assert payload["user_id"] == actor_id
    assert payload["email"] == "dev@example.com"
    assert payload["organisation_id"] == org_id


def test_oidc_mode_rejects_missing_jwt(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    org_id = str(uuid4())

    response = client.get(
        "/api/auth/whoami",
        headers={"X-Organisation-Id": org_id},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing bearer token"


def test_oidc_mode_rejects_invalid_jwt(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    org_id = str(uuid4())

    response = client.get(
        "/api/auth/whoami",
        headers={
            "X-Organisation-Id": org_id,
            "Authorization": "Bearer invalid",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid bearer token"


def test_oidc_mode_rejects_user_not_provisioned(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    oidc._JWKS_CACHE.clear()

    secret = b"test-secret"
    token = _build_hs256_token(
        secret, "https://issuer.example.com", "api://audience"
    )
    jwks = {
        "keys": [
            {
                "kty": "oct",
                "k": _b64url(secret),
                "kid": "test-key",
                "alg": "HS256",
                "use": "sig",
            }
        ]
    }

    monkeypatch.setattr(oidc, "_fetch_jwks", lambda issuer: jwks)
    monkeypatch.setattr(oidc, "_find_user_account", lambda *args: None)

    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    org_id = str(uuid4())

    response = client.get(
        "/api/auth/whoami",
        headers={
            "X-Organisation-Id": org_id,
            "Authorization": f"Bearer {token}",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "User not provisioned for this organisation"
    )
