import time

import jwt
import pytest

from app.core import oidc as oidc_core


def _b64url(value: bytes) -> str:
    return jwt.utils.base64url_encode(value).decode("utf-8")


def _build_token(secret: bytes, issuer: str, audience: str, exp: int) -> str:
    now = int(time.time())
    payload = {
        "sub": "user-subject",
        "email": "user@example.com",
        "iss": issuer,
        "aud": audience,
        "nbf": now - 5,
        "exp": exp,
    }
    return jwt.encode(
        payload,
        secret,
        algorithm="HS256",
        headers={"kid": "test-key"},
    )


def _jwks_for_secret(secret: bytes) -> dict[str, list[dict[str, str]]]:
    return {
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


def test_verify_jwt_rejects_invalid_signature(monkeypatch) -> None:
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    token = _build_token(
        b"secret-one",
        "https://issuer.example.com",
        "api://audience",
        exp=int(time.time()) + 60,
    )
    monkeypatch.setattr(
        oidc_core, "fetch_jwks", lambda: _jwks_for_secret(b"secret-two")
    )

    with pytest.raises(jwt.InvalidTokenError):
        oidc_core.verify_jwt(token)


def test_verify_jwt_rejects_wrong_issuer(monkeypatch) -> None:
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    secret = b"secret"
    token = _build_token(
        secret,
        "https://wrong.example.com",
        "api://audience",
        exp=int(time.time()) + 60,
    )
    monkeypatch.setattr(
        oidc_core, "fetch_jwks", lambda: _jwks_for_secret(secret)
    )

    with pytest.raises(jwt.InvalidTokenError):
        oidc_core.verify_jwt(token)


def test_verify_jwt_rejects_wrong_audience(monkeypatch) -> None:
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    secret = b"secret"
    token = _build_token(
        secret,
        "https://issuer.example.com",
        "api://wrong-audience",
        exp=int(time.time()) + 60,
    )
    monkeypatch.setattr(
        oidc_core, "fetch_jwks", lambda: _jwks_for_secret(secret)
    )

    with pytest.raises(jwt.InvalidTokenError):
        oidc_core.verify_jwt(token)


def test_verify_jwt_rejects_expired_token(monkeypatch) -> None:
    monkeypatch.setenv("OIDC_ISSUER_URL", "https://issuer.example.com")
    monkeypatch.setenv("OIDC_AUDIENCE", "api://audience")
    oidc_core._JWKS_CACHE.clear()
    monkeypatch.setattr(oidc_core, "_ALLOWED_ALGORITHMS", {"HS256"})

    secret = b"secret"
    token = _build_token(
        secret,
        "https://issuer.example.com",
        "api://audience",
        exp=int(time.time()) - 10,
    )
    monkeypatch.setattr(
        oidc_core, "fetch_jwks", lambda: _jwks_for_secret(secret)
    )

    with pytest.raises(jwt.InvalidTokenError):
        oidc_core.verify_jwt(token)
