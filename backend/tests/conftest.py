import os

import pytest
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, engine, get_db
from app.main import app


@pytest.fixture(autouse=True)
def db_session_override():
    if os.getenv("RUN_DB_TESTS") != "1":
        yield
        return

    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    SessionLocal.configure(bind=connection)
    original_overrides = app.dependency_overrides.copy()

    def _override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    try:
        yield
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        SessionLocal.configure(bind=engine)
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)
