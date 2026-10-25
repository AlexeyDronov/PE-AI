from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from sqlmodel import Session


@dataclass(frozen=True)
class CommandSpec:
    """One write: POST /api/commands/{name}. The handler returns the written row."""

    name: str
    input_schema: type[BaseModel]
    output_schema: type[BaseModel]
    handler: Callable[[Any, Session], BaseModel]
    invalidates: tuple[str, ...]
    status_code: int = 200
    async_job: str | None = None
