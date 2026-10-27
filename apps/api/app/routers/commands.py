from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.commands import COMMANDS
from app.commands.spec import CommandSpec
from app.core.auth import require_admin
from app.core.db import write_session
from app.core.errors import UnknownCommand
from app.jobs.runner import dispatch_job

router = APIRouter(prefix="/api/commands", tags=["commands"])


def _endpoint(spec: CommandSpec) -> Callable[..., Awaitable[JSONResponse]]:
    async def run(request: Request, body: spec.input_schema) -> JSONResponse:  # type: ignore[name-defined]
        app = request.app
        with write_session(app.state.settings.database_path) as session:
            row = spec.handler(body, session)
            session.commit()
        await app.state.events.publish(
            {"type": "changed", "resources": list(spec.invalidates), "ids": [row.id]}
        )
        if spec.async_job:
            row = await dispatch_job(app, row)
        return JSONResponse(jsonable_encoder(row), status_code=spec.status_code)

    return run


for _spec in COMMANDS:
    router.add_api_route(
        f"/{_spec.name}",
        _endpoint(_spec),
        methods=["POST"],
        response_model=_spec.output_schema,
        status_code=_spec.status_code,
        name=_spec.name,
        # Agent jobs are open to every signed-in user (guests included); other commands save changes.
        dependencies=[] if _spec.async_job else [Depends(require_admin)],
    )


@router.post("/{name}", include_in_schema=False)
async def unknown_command(name: str, body: dict[str, Any]) -> None:
    raise UnknownCommand(f"Unknown command '{name}'")
