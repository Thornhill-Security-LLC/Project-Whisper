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
