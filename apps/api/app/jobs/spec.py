from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from sqlmodel import Session, SQLModel

from app.models import Job


@dataclass(frozen=True)
class JobKindSpec:
    """One agent capability: its input, result contract, persistence and live-update scope."""

    kind: str
    input_schema: type[BaseModel]
    result_schema: type[BaseModel]
    persist: Callable[[Session, Job, Any], SQLModel]
    invalidates: tuple[str, ...]
