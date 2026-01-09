from __future__ import annotations

import json
import time
from typing import Any

import httpx
import jwt
from fastapi import HTTPException
from jwt import ExpiredSignatureError, InvalidTokenError, PyJWTError

from app.core.config import (
    get_oidc_audience,
    get_oidc_clock_skew_seconds,
    get_oidc_http_timeout_seconds,
    get_oidc_issuer_url,
    get_oidc_jwks_cache_seconds,
    get_oidc_jwks_url,
)

_JWKS_CACHE: dict[str, dict[str, Any]] = {}
_ALLOWED_ALGORITHMS = {
    "RS256",
    "RS384",
    "RS512",
    "ES256",
    "ES384",
    "ES512",
}


def validate_oidc_settings() -> None:
    issuer = get_oidc_issuer_url()
    audience = get_oidc_audience()
    jwks_url = get_oidc_jwks_url()
    if not issuer or not audience or not jwks_url:
        raise RuntimeError("OIDC configuration missing")

    _validate_positive_setting(
        get_oidc_http_timeout_seconds(), "OIDC_HTTP_TIMEOUT_SECONDS"
    )
    _validate_positive_setting(
        get_oidc_jwks_cache_seconds(), "OIDC_JWKS_CACHE_SECONDS"
    )
    _validate_non_negative_setting(
        get_oidc_clock_skew_seconds(), "OIDC_CLOCK_SKEW_SECONDS"
    )


def fetch_jwks() -> dict[str, Any]:
    jwks_url = get_oidc_jwks_url()
    if not jwks_url:
        raise _invalid_token("OIDC configuration missing")

    cache_seconds = get_oidc_jwks_cache_seconds()
    now = time.time()
    cache_entry = _JWKS_CACHE.get(jwks_url)
    if cache_entry and cache_entry["expires_at"] > now:
        return cache_entry["jwks"]

    timeout = get_oidc_http_timeout_seconds()
    try:
        jwks_response = httpx.get(jwks_url, timeout=timeout)
        jwks_response.raise_for_status()
        jwks = jwks_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise _invalid_token("Invalid bearer token") from exc

    _JWKS_CACHE[jwks_url] = {
        "expires_at": now + cache_seconds,
        "jwks": jwks,
    }
    return jwks


def verify_bearer_token(auth_header: str | None) -> str:
    if not auth_header:
        raise _invalid_token("Invalid bearer token")
    if not auth_header.lower().startswith("bearer "):
        raise _invalid_token("Invalid bearer token")
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise _invalid_token("Invalid bearer token")
    return token


def verify_jwt(token: str) -> dict[str, Any]:
    issuer = get_oidc_issuer_url()
    audience = get_oidc_audience()
    clock_skew = get_oidc_clock_skew_seconds()
    if not issuer or not audience:
        raise _invalid_token("OIDC configuration missing")

    try:
        header = jwt.get_unverified_header(token)
    except InvalidTokenError as exc:
        raise _invalid_token("Invalid bearer token") from exc

    alg = header.get("alg")
    if alg not in _ALLOWED_ALGORITHMS:
        raise _invalid_token("Invalid bearer token")

    jwks = fetch_jwks()
    signing_key = _get_signing_key(
        jwks=jwks,
        kid=header.get("kid"),
        alg=alg,
    )

    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            audience=audience,
            issuer=issuer,
            options={
                "require": ["exp", "iss", "aud", "sub"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": False,
                "verify_aud": True,
                "verify_iss": True,
            },
            leeway=clock_skew,
        )
    except (ExpiredSignatureError, InvalidTokenError, PyJWTError) as exc:
        raise _invalid_token("Invalid bearer token") from exc

    _validate_required_claims(claims)
    return claims


def _validate_required_claims(claims: dict[str, Any]) -> None:
    subject = claims.get("sub")
    if not subject:
        raise _invalid_token("Invalid bearer token")

    email = claims.get("email")
    if email is not None and not str(email).strip():
        raise _invalid_token("Invalid bearer token")

    preferred_username = claims.get("preferred_username")
    if preferred_username is not None and not str(preferred_username).strip():
        raise _invalid_token("Invalid bearer token")


def _get_signing_key(
    jwks: dict[str, Any], kid: str | None, alg: str
) -> Any:
    if not kid:
        raise _invalid_token("Invalid bearer token")

    jwks_algorithms = {
        key.get("alg") for key in jwks.get("keys", []) if key.get("alg")
    }
    if jwks_algorithms and alg not in jwks_algorithms:
        raise _invalid_token("Invalid bearer token")

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            key_alg = key.get("alg")
            if key_alg and key_alg != alg:
                raise _invalid_token("Invalid bearer token")
            try:
                algorithm = jwt.algorithms.get_default_algorithms()[alg]
                return algorithm.from_jwk(json.dumps(key))
            except Exception as exc:
                raise _invalid_token("Invalid bearer token") from exc

    raise _invalid_token("Invalid bearer token")


def _invalid_token(message: str) -> HTTPException:
    return HTTPException(status_code=401, detail=message)


def _validate_positive_setting(value: int, name: str) -> None:
    if value <= 0:
        raise RuntimeError(f"{name} must be > 0")


def _validate_non_negative_setting(value: int, name: str) -> None:
    if value < 0:
        raise RuntimeError(f"{name} must be >= 0")
