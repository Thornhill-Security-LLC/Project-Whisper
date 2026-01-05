from __future__ import annotations

import json
import time
from uuid import UUID
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import (
    get_oidc_audience,
    get_oidc_issuer_url,
    get_oidc_jwks_cache_seconds,
)
from app.core.tenant import require_tenant_context
from app.db.models import UserAccount

_JWKS_CACHE: dict[str, dict[str, Any]] = {}
_ALLOWED_ALGORITHMS = {
    "RS256",
    "RS384",
    "RS512",
    "ES256",
    "ES384",
    "ES512",
    "HS256",
    "HS384",
    "HS512",
}


def get_actor(request: Request, db: Session) -> dict[str, UUID | str | None]:
    organisation_id = require_tenant_context(request)
    token = _get_bearer_token(request)

    issuer = get_oidc_issuer_url()
    audience = get_oidc_audience()
    if not issuer or not audience:
        raise HTTPException(
            status_code=500, detail="OIDC configuration missing"
        )

    claims = _decode_token(
        token=token,
        issuer=issuer,
        audience=audience,
        cache_seconds=get_oidc_jwks_cache_seconds(),
    )

    subject = claims.get("sub")
    identity = claims.get("email") or claims.get("preferred_username")
    if not identity:
        raise HTTPException(
            status_code=401, detail="Token missing email or username"
        )

    user = _find_user_account(db, organisation_id, identity)
    if user is None:
        raise HTTPException(
            status_code=403,
            detail="User not provisioned for this organisation",
        )

    return {
        "actor_user_id": user.id,
        "actor_email": user.email,
        "actor_subject": subject,
        "auth_mode": "oidc",
    }


def _find_user_account(
    db: Session, organisation_id: UUID, identity: str
) -> UserAccount | None:
    return (
        db.execute(
            select(UserAccount).where(
                UserAccount.organisation_id == organisation_id,
                UserAccount.email == identity,
            )
        )
        .scalars()
        .one_or_none()
    )


def _get_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return auth_header.split(" ", 1)[1].strip()


def _decode_token(
    token: str, issuer: str, audience: str, cache_seconds: int
) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401, detail="Invalid bearer token"
        ) from exc

    alg = header.get("alg")
    if alg not in _ALLOWED_ALGORITHMS:
        raise HTTPException(
            status_code=401, detail="Unsupported token algorithm"
        )

    signing_key = _get_signing_key(
        issuer=issuer, kid=header.get("kid"), alg=alg, cache_seconds=cache_seconds
    )

    try:
        return jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401, detail="Invalid bearer token"
        ) from exc


def _get_signing_key(
    issuer: str, kid: str | None, alg: str, cache_seconds: int
) -> Any:
    if not kid:
        raise HTTPException(status_code=401, detail="Invalid bearer token")

    jwks = _get_jwks(issuer, cache_seconds)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            try:
                algorithm = jwt.algorithms.get_default_algorithms()[alg]
                return algorithm.from_jwk(json.dumps(key))
            except Exception as exc:
                raise HTTPException(
                    status_code=401, detail="Invalid bearer token"
                ) from exc

    raise HTTPException(status_code=401, detail="Invalid bearer token")


def _get_jwks(issuer: str, cache_seconds: int) -> dict[str, Any]:
    cache_entry = _JWKS_CACHE.get(issuer)
    now = time.time()
    if cache_entry and cache_entry["expires_at"] > now:
        return cache_entry["jwks"]

    try:
        jwks = _fetch_jwks(issuer)
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=500, detail="OIDC JWKS fetch failed"
        ) from exc

    _JWKS_CACHE[issuer] = {
        "expires_at": now + cache_seconds,
        "jwks": jwks,
    }
    return jwks


def _fetch_jwks(issuer: str) -> dict[str, Any]:
    config_url = issuer.rstrip("/") + "/.well-known/openid-configuration"
    config_response = httpx.get(config_url, timeout=5.0)
    config_response.raise_for_status()
    jwks_uri = config_response.json().get("jwks_uri")
    if not jwks_uri:
        raise ValueError("JWKS URI missing in OIDC configuration")

    jwks_response = httpx.get(jwks_uri, timeout=5.0)
    jwks_response.raise_for_status()
    return jwks_response.json()
