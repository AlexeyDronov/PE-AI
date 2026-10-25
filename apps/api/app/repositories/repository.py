from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, SQLModel, select

from app.core.errors import InvalidFilter, NotFound


@dataclass(frozen=True)
class Page[T: SQLModel]:
    items: list[T]
    total: int


class Repository[T: SQLModel]:
    """Generic read-only access to one table."""

    def __init__(self, model: type[T], session: Session) -> None:
        self.model = model
        self.session = session

    def _column(self, name: str) -> Any:
        columns = self.model.__table__.columns  # type: ignore[attr-defined]
        if name not in columns:
            raise InvalidFilter(f"Unknown field '{name}'", {"field": name})
        return getattr(self.model, name)

    def _coerce(self, name: str, value: Any) -> Any:
        python_type = self._column(name).type.python_type
        if python_type is bool and isinstance(value, str):
            return value.lower() in ("1", "true", "yes")
        if python_type in (int, float) and isinstance(value, str):
            try:
                return python_type(value)
            except ValueError:
                raise InvalidFilter(f"Invalid value for '{name}'", {"field": name}) from None
        return value

    def list(
        self,
        filters: Mapping[str, Any] | None = None,
        sort: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> Page[T]:
        """Filtered, sorted, paginated rows plus the unpaginated total."""
        query = select(self.model)
        for name, value in (filters or {}).items():
            query = query.where(self._column(name) == self._coerce(name, value))
        total = self.session.exec(select(func.count()).select_from(query.subquery())).one()
        order = [self.model.id]  # type: ignore[attr-defined]
        if sort:
            column = self._column(sort.removeprefix("-"))
            order.insert(0, column.desc() if sort.startswith("-") else column.asc())
        items = self.session.exec(query.order_by(*order).limit(limit).offset(offset)).all()
        return Page(items=list(items), total=total)

    def get(self, id: str) -> T:
        """One row by id; raises NotFound."""
        item = self.session.get(self.model, id)
        if item is None:
            raise NotFound(f"{self.model.__tablename__} '{id}' not found")  # type: ignore[attr-defined]
        return item
