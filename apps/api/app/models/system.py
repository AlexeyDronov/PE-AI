from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field

from app.models.base import Writable, utcnow


class Job(Writable, table=True):
    __tablename__ = "jobs"
    kind: str = Field(index=True)
    status: str = Field(default="queued", index=True)
    input: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    progress: list[Any] = Field(default_factory=list, sa_column=Column(JSON))
    result_ref: str | None = None
    error: str | None = None
    usage: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    updated_at: datetime = Field(default_factory=utcnow)
