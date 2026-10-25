import hashlib
import json
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.encoders import jsonable_encoder
from sqlmodel import Session

from app.compute import COMPUTES
from app.compute.spec import ComputeSpec
from app.core.errors import UnknownCompute
from app.routers.factory import get_read_session

router = APIRouter(prefix="/api/compute", tags=["compute"])


def _endpoint(spec: ComputeSpec) -> Callable[..., Response]:
    def run(
        request: Request,
        body: spec.input_schema,  # type: ignore[name-defined]
        session: Annotated[Session, Depends(get_read_session)],
    ) -> Response:
        app = request.app
        canonical = json.dumps(body.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
        key = (spec.name, hashlib.sha256(canonical.encode()).hexdigest(), app.state.events.data_version)
        payload = app.state.compute_cache.get(key)
        cache = "hit"
        if payload is None:
            cache = "miss"
            payload = json.dumps(jsonable_encoder(spec.handler(body, session))).encode()
            app.state.compute_cache.put(key, payload)
        return Response(payload, media_type="application/json", headers={"X-Cache": cache})

    return run


for _spec in COMPUTES:
    router.add_api_route(
        f"/{_spec.name}",
        _endpoint(_spec),
        methods=["POST"],
        response_model=_spec.output_schema,
        name=_spec.name,
    )


@router.post("/{name}", include_in_schema=False)
def unknown_compute(name: str, body: dict[str, Any]) -> None:
    raise UnknownCompute(f"Unknown calculation '{name}'")
