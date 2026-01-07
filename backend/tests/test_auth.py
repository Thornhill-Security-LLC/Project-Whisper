import base64
import time
from uuid import uuid4

import jwt
from fastapi.testclient import TestClient

from app.core import oidc as oidc_core
from app.core.auth import oidc
from app.db.models import UserAccount
from app.db.session import get_db
from app.main import app


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _build_hs256_token(
    secret: bytes,
    issuer: str,
    audience: str,
    exp_offset: int = 60,
) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": "user-subject",
            "email": "user@example.com",
            "iss": issuer,
            "aud": audience,
            "nbf": now - 5,
            "exp": now + exp_offset,
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
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
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
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
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


def test_oidc_mode_rejects_invalid_bearer_format(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    org_id = str(uuid4())

    response = client.get(
        "/api/auth/whoami",
        headers={
            "X-Organisation-Id": org_id,
            "Authorization": "Token abc",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid bearer token"


def test_oidc_mode_rejects_wrong_issuer(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    secret = b"test-secret"
    token = _build_hs256_token(
        secret, "https://wrong.example.com", "api://audience"
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

    monkeypatch.setattr(oidc_core, "fetch_jwks", lambda: jwks)
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

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid bearer token"


def test_oidc_mode_rejects_wrong_audience(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    secret = b"test-secret"
    token = _build_hs256_token(
        secret, "https://issuer.example.com", "api://wrong"
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

    monkeypatch.setattr(oidc_core, "fetch_jwks", lambda: jwks)
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

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid bearer token"


def test_oidc_mode_rejects_expired_token(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    secret = b"test-secret"
    token = _build_hs256_token(
        secret,
        "https://issuer.example.com",
        "api://audience",
        exp_offset=-10,
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

    monkeypatch.setattr(oidc_core, "fetch_jwks", lambda: jwks)
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

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid bearer token"


def test_oidc_mode_rejects_user_not_provisioned(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(
        oidc_core,
        "_ALLOWED_ALGORITHMS",
        {"HS256"},
    )

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

    monkeypatch.setattr(oidc_core, "fetch_jwks", lambda: jwks)
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


def test_oidc_mode_accepts_provisioned_user(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    monkeypatch.setenv(
        "OIDC_JWKS_URL", "https://issuer.example.com/.well-known/jwks.json"
    )
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(
        oidc_core,
        "_ALLOWED_ALGORITHMS",
        {"HS256"},
    )

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

    actor_user = UserAccount(
        organisation_id=uuid4(),
        email="user@example.com",
        display_name="Test User",
    )
    actor_user.id = uuid4()

    monkeypatch.setattr(oidc_core, "fetch_jwks", lambda: jwks)
    monkeypatch.setattr(oidc, "_find_user_account", lambda *args, **kwargs: actor_user)

    app.dependency_overrides[get_db] = _override_db
    client = TestClient(app)
    org_id = str(actor_user.organisation_id)

    response = client.get(
        "/api/auth/whoami",
        headers={
            "X-Organisation-Id": org_id,
            "Authorization": f"Bearer {token}",
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["auth_mode"] == "oidc"
    assert payload["user_id"] == str(actor_user.id)
    assert payload["email"] == actor_user.email
    assert payload["subject"] == "user-subject"
    assert payload["organisation_id"] == org_id
