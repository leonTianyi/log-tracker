"""The four tables from the ERD.

Note: the log's per-field answers live in `field_values` (a JSON blob), NOT a
column literally named `metadata` — SQLAlchemy reserves that name on models.
Same idea we drew, just a safer column name.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, Relationship, SQLModel


class Log(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # "<date>/<name>", e.g. "2026.05/checkout_run" — unique, the identity.
    natural_key: str = Field(index=True, unique=True)
    current_stage: Optional[str] = Field(default=None)
    field_values: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(default=None)

    paths: list["LogPath"] = Relationship(
        back_populates="log",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    stages: list["StageStatus"] = Relationship(
        back_populates="log",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class LogPath(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: int = Field(foreign_key="log.id", index=True)
    bucket: str
    uri: str = Field(unique=True, index=True)
    kind: str = Field(default="primary")  # primary | mirror

    log: Optional[Log] = Relationship(back_populates="paths")


class StageStatus(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: int = Field(foreign_key="log.id", index=True)
    stage: str
    state: str = Field(default="todo")  # todo | in_progress | done | blocked | na
    done_at: Optional[datetime] = Field(default=None)
    done_by: Optional[str] = Field(default=None)

    log: Optional[Log] = Relationship(back_populates="stages")


class FieldDefinition(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)
    label: str
    type: str = Field(default="text")  # text | number | bool | enum | date
    options: Optional[list] = Field(default=None, sa_column=Column(JSON))
    category: str = Field(default="metadata")  # metadata | amendment
    sort_order: int = Field(default=0)
    active: bool = Field(default=True)
