from datetime import UTC, datetime

from sqlmodel import Field, SQLModel
from ulid import ULID


def new_id() -> str:
    return str(ULID())


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(SQLModel):
    """Common columns: ULID primary key and creation time."""

    id: str = Field(default_factory=new_id, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)


class Writable(Base):
    """Base for tables that users or agents may write; `source` is seed | user | agent."""

    source: str = Field(default="user")
