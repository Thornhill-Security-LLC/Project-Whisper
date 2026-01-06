from __future__ import annotations

import json
import time
from typing import Any

import httpx
import jwt
from jwt import InvalidTokenError

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


def fetch_jwks() -> dict[str, Any]:
    issuer = get_oidc_issuer_url()
    jwks_url = get_oidc_jwks_url()
    timeout = get_oidc_http_timeout_seconds()
    if not issuer:
        raise ValueError("OIDC issuer is required")

    if not jwks_url:
        config_url = issuer.rstrip("/") + "/.well-known/openid-configuration"
        config_response = httpx.get(config_url, timeout=timeout)
        config_response.raise_for_status()
        jwks_url = config_response.json().get("jwks_uri")

    if not jwks_url:
        raise ValueError("JWKS URI missing in OIDC configuration")

    jwks_response = httpx.get(jwks_url, timeout=timeout)
    jwks_response.raise_for_status()
    return jwks_response.json()


def verify_jwt(token: str) -> dict[str, Any]:
    issuer = get_oidc_issuer_url()
    audience = get_oidc_audience()
    jwks_cache_seconds = get_oidc_jwks_cache_seconds()
    clock_skew = get_oidc_clock_skew_seconds()
    if not issuer or not audience:
        raise _invalid_token("OIDC configuration missing")

    try:
        header = jwt.get_unverified_header(token)
    except InvalidTokenError as exc:
        raise _invalid_token("Invalid bearer token") from exc

    alg = header.get("alg")
    if alg not in _ALLOWED_ALGORITHMS:
        raise _invalid_token("Unsupported token algorithm")

    signing_key = _get_signing_key(
        issuer=issuer,
        kid=header.get("kid"),
        alg=alg,
        cache_seconds=jwks_cache_seconds,
    )

    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
            leeway=clock_skew,
        )
    except InvalidTokenError as exc:
        raise _invalid_token("Invalid bearer token") from exc

    _validate_required_claims(claims)
    return claims


def _validate_required_claims(claims: dict[str, Any]) -> None:
    subject = claims.get("sub")
    if not subject:
        raise _invalid_token("Token missing subject")

    email = claims.get("email")
    if email is not None and not str(email).strip():
        raise _invalid_token("Token missing email")

    preferred_username = claims.get("preferred_username")
    if preferred_username is not None and not str(preferred_username).strip():
        raise _invalid_token("Token missing username")


def _get_signing_key(
    issuer: str, kid: str | None, alg: str, cache_seconds: int
) -> Any:
    if not kid:
        raise _invalid_token("Invalid bearer token")

    jwks = _get_jwks(issuer, cache_seconds)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            try:
                algorithm = jwt.algorithms.get_default_algorithms()[alg]
                return algorithm.from_jwk(json.dumps(key))
            except Exception as exc:
                raise _invalid_token("Invalid bearer token") from exc

    raise _invalid_token("Invalid bearer token")


def _get_jwks(issuer: str, cache_seconds: int) -> dict[str, Any]:
    cache_entry = _JWKS_CACHE.get(issuer)
    now = time.time()
    if cache_entry and cache_entry["expires_at"] > now:
        return cache_entry["jwks"]

    try:
        jwks = fetch_jwks()
    except (httpx.HTTPError, ValueError) as exc:
        raise _invalid_token("Invalid bearer token") from exc
    _JWKS_CACHE[issuer] = {
        "expires_at": now + cache_seconds,
        "jwks": jwks,
    }
    return jwks


def _invalid_token(message: str) -> InvalidTokenError:
    return InvalidTokenError(message)
