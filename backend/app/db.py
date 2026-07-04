"""SQLite engine + session helpers. Swap the URL for Postgres in Phase 2."""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

# One file on disk. Override with DATABASE_URL when we move to Postgres.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./log_tracker.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=_connect_args)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
