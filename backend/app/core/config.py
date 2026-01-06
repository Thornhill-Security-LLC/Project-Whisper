import os
from urllib.parse import quote_plus


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "whisper")
    user = os.getenv("POSTGRES_USER", "whisper")
    password = os.getenv("POSTGRES_PASSWORD", "whisper_dev_password")

    safe_user = quote_plus(user)
    safe_password = quote_plus(password)

    return f"postgresql+psycopg://{safe_user}:{safe_password}@{host}:{port}/{database}"


def get_evidence_storage_backend() -> str:
    return os.getenv("EVIDENCE_STORAGE_BACKEND", "local").lower()


def get_gcs_bucket_name() -> str | None:
    return os.getenv("GCS_BUCKET_NAME")


def get_gcs_signed_url_ttl_seconds() -> int:
    value = os.getenv("GCS_SIGNED_URL_TTL_SECONDS", "300")
    return int(value)


def get_gcp_project_id() -> str | None:
    return os.getenv("GCP_PROJECT_ID")


def get_auth_mode() -> str:
    return os.getenv("AUTH_MODE", "dev").lower()


def get_oidc_issuer_url() -> str | None:
    return os.getenv("OIDC_ISSUER_URL")


def get_oidc_audience() -> str | None:
    return os.getenv("OIDC_AUDIENCE")


def get_oidc_jwks_url() -> str | None:
    return os.getenv("OIDC_JWKS_URL")


def get_oidc_jwks_cache_seconds() -> int:
    value = os.getenv("OIDC_JWKS_CACHE_SECONDS", "3600")
    return int(value)


def get_oidc_clock_skew_seconds() -> int:
    value = os.getenv("OIDC_CLOCK_SKEW_SECONDS", "60")
    return int(value)


def get_oidc_http_timeout_seconds() -> int:
    value = os.getenv("OIDC_HTTP_TIMEOUT_SECONDS", "5")
    return int(value)
