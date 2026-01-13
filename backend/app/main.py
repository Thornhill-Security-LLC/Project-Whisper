from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import api_router
from app.core.config import get_auth_mode, get_cors_allow_origins
from app.core.oidc import validate_oidc_settings
from app.db.session import get_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    if get_auth_mode() == "oidc":
        validate_oidc_settings()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_allow_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)
app.include_router(api_router, prefix="/api")

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
