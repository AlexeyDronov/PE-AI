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
    updated_at: datetime = Field(default_factory=utcnow)


class Annotation(Writable, table=True):
    __tablename__ = "annotations"
    route: str = Field(index=True)
    selector: str
    note: str
    rect_x: float | None = None
    rect_y: float | None = None
    rect_w: float | None = None
    rect_h: float | None = None
    viewport_w: int
    viewport_h: int
    theme: str
    status: str = Field(default="open", index=True)
    screenshot_path: str | None = None
