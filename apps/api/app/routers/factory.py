from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session

from app.core.db import read_session
from app.core.errors import InvalidFilter
from app.repositories.repository import Repository
from app.resources import ResourceSpec
from app.schemas import Page

RESERVED_PARAMS = frozenset({"sort", "limit", "offset"})
MAX_ROWS = 100_000


def get_read_session(request: Request) -> Iterator[Session]:
    with read_session(request.app.state.settings.database_path) as session:
        yield session


def make_resource_router(spec: ResourceSpec) -> APIRouter:
    """Build the GET list and GET detail routes for one registry entry."""
    router = APIRouter(prefix=f"/api/{spec.name}", tags=[spec.name])
    read_model = spec.read_schema or spec.model
    filter_params = [
        {"name": name, "in": "query", "required": False, "schema": {"type": "string"}}
        for name in (*spec.filters, *spec.computed_filters)
    ]

    def enrich(session: Session, items: list[Any], detail: bool = False) -> list[Any]:
        return spec.enrich(session, items, detail) if spec.enrich else items

    if not spec.detail_only:

        @router.get("", response_model=Page[read_model], openapi_extra={"parameters": filter_params})  # type: ignore[valid-type]
        def list_items(
            request: Request,
            session: Annotated[Session, Depends(get_read_session)],
            sort: str | None = None,
            limit: Annotated[int, Query(ge=1, le=1000)] = 200,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> dict[str, Any]:
            params = {k: v for k, v in request.query_params.items() if k not in RESERVED_PARAMS}
            unknown = sorted(set(params) - set(spec.filters) - set(spec.computed_filters))
            if unknown:
                raise InvalidFilter(
                    f"Unknown filter(s): {', '.join(unknown)}",
                    {"allowed": (*spec.filters, *spec.computed_filters)},
                )
            computed = {k: v for k, v in params.items() if k in spec.computed_filters}
            filters = {k: v for k, v in params.items() if k not in computed}
            sort_key = sort.removeprefix("-") if sort else None
            if not computed and sort_key not in spec.computed_sorts:
                page = Repository(spec.model, session).list(filters, sort, limit, offset)
                return {"items": enrich(session, page.items), "total": page.total}
            rows = enrich(session, Repository(spec.model, session).list(filters, None, MAX_ROWS).items)
            for key, value in computed.items():
                rows = [r for r in rows if spec.computed_filters[key](r) == value]
            if sort_key in spec.computed_sorts:
                rows.sort(key=spec.computed_sorts[sort_key], reverse=bool(sort and sort.startswith("-")))
            return {"items": rows[offset : offset + limit], "total": len(rows)}

    @router.get("/{id}", response_model=spec.detail_schema or read_model)
    def get_item(id: str, session: Annotated[Session, Depends(get_read_session)]) -> Any:
        return enrich(session, [Repository(spec.model, session).get(id)], True)[0]

    return router
