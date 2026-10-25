from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock
from typing import Any, get_type_hints

from pydantic import BaseModel
from sqlmodel import Session


@dataclass(frozen=True)
class ComputeSpec:
    """One stateless calculation: POST /api/compute/{name}. The handler returns a serialisable model."""

    name: str
    input_schema: type[BaseModel]
    handler: Callable[[Any, Session], BaseModel]

    @property
    def output_schema(self) -> type[BaseModel]:
        """The handler's return annotation, which is the response model."""
        return get_type_hints(self.handler)["return"]


class ComputeCache:
    """Bounded least-recently-used cache of encoded responses."""

    def __init__(self, max_entries: int = 512) -> None:
        self._max = max_entries
        self._items: OrderedDict[tuple, bytes] = OrderedDict()
        self._lock = Lock()

    def get(self, key: tuple) -> bytes | None:
        with self._lock:
            if key in self._items:
                self._items.move_to_end(key)
                return self._items[key]
            return None

    def put(self, key: tuple, value: bytes) -> None:
        with self._lock:
            self._items[key] = value
            self._items.move_to_end(key)
            while len(self._items) > self._max:
                self._items.popitem(last=False)
