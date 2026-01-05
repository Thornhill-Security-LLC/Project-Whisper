import os

import pytest
from sqlalchemy import event
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
    session = Session(bind=connection, expire_on_commit=False)
    session.begin_nested()
    SessionLocal.configure(bind=connection)
    original_overrides = app.dependency_overrides.copy()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(session_to_restart, transaction_to_end):
        if transaction_to_end.nested and not session_to_restart.in_nested_transaction():
            session_to_restart.begin_nested()

    def _override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    try:
        yield
    finally:
        event.remove(session, "after_transaction_end", _restart_savepoint)
        session.close()
        transaction.rollback()
        connection.close()
        SessionLocal.configure(bind=engine)
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)
