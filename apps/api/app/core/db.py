from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session

WRITABLE_TABLES: frozenset[str] = frozenset(
    {
        "annotations",
        "jobs",
        "teasers",
        "companies",
        "deals",
        "deal_financials",
        "risk_flags",
        "diligence_questions",
        "watchlist_entries",
        "lbo_scenarios",
        "memos",
        "memo_sections",
        "research_reports",
        "research_findings",
        "sources",
    }
)

_read_engines: dict[Path, Engine] = {}
_write_engines: dict[Path, Engine] = {}


class ReadOnlyViolation(Exception):
    """Raised when a write session tries to touch reference data or seed rows."""


def read_engine(path: Path) -> Engine:
    """Engine whose SQLite connection is opened read-only, so it cannot write."""
    path = Path(path)
    if path not in _read_engines:
        _read_engines[path] = create_engine(
            f"sqlite:///file:{path}?mode=ro&uri=true", connect_args={"check_same_thread": False}
        )
    return _read_engines[path]


def write_engine(path: Path) -> Engine:
    """Engine for the write path; sessions on it are fenced by the flush guard."""
    path = Path(path)
    if path not in _write_engines:
        engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
        _write_engines[path] = engine
    return _write_engines[path]


def read_session(path: Path) -> Session:
    return Session(read_engine(path))


@event.listens_for(OrmSession, "before_flush")
def _guard_writes(session: OrmSession, _ctx: object, _instances: object) -> None:
    if session.get_bind() not in _write_engines.values():
        return
    touched = [*session.new, *(o for o in session.dirty if session.is_modified(o)), *session.deleted]
    for obj in touched:
        table = obj.__table__.name
        if table not in WRITABLE_TABLES:
            raise ReadOnlyViolation(f"table '{table}' is read-only")
    for obj in [*(o for o in session.dirty if session.is_modified(o)), *session.deleted]:
        if getattr(obj, "source", None) == "seed":
            raise ReadOnlyViolation(f"seed row in '{obj.__table__.name}' cannot be changed")


def write_session(path: Path) -> Session:
    """Session on the write engine; rows stay readable after commit."""
    return Session(write_engine(path), expire_on_commit=False)
