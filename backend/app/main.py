from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import api_router
from app.core.config import get_auth_mode
from app.core.oidc import validate_oidc_settings
from app.db.session import get_db

app = FastAPI()
app.include_router(api_router, prefix="/api")


@app.on_event("startup")
def validate_configuration() -> None:
    if get_auth_mode() == "oidc":
        validate_oidc_settings()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="Database connection failed"
        ) from exc

    return {"status": "ok"}
