from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.organisation import router as organisation_router
from app.api.routes.user_account import router as user_router
from app.db.session import get_db

app = FastAPI()
app.include_router(organisation_router, prefix="/api")
app.include_router(user_router, prefix="/api")


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
