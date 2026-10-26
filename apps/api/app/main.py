from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.compute.spec import ComputeCache
from app.core.config import Settings
from app.core.errors import install_error_handlers
from app.core.events import EventBus
from app.jobs.agent_client import AgentClient
from app.jobs.registry import JOB_KINDS
from app.resources import RESOURCES
from app.routers import commands, compute, exports, internal, overview, pipeline, portfolio
from app.routers.events import stream_events
from app.routers.factory import make_resource_router


def create_app(settings: Settings | None = None, agent_client: Any = None) -> FastAPI:
    """Application factory; engines are created lazily on first request."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        await app.state.events.close()

    app = FastAPI(title="Harrowgate Deal Copilot API", lifespan=lifespan)
    app.state.settings = settings or Settings()
    app.state.agent_client = agent_client or AgentClient(
        app.state.settings.agent_url, app.state.settings.agent_service_token
    )
    app.state.events = EventBus()
    app.state.compute_cache = ComputeCache()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app.state.settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )
    install_error_handlers(app)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for spec in RESOURCES:
        app.include_router(make_resource_router(spec))
    app.add_api_route("/api/events", stream_events, tags=["events"])
    for module in (commands, compute, exports, internal, overview, pipeline, portfolio):
        app.include_router(module.router)

    base_openapi = app.openapi

    def openapi() -> dict[str, Any]:
        """Adds the agent job result models, which no route returns, so codegen can export them."""
        if app.openapi_schema is None:
            doc = base_openapi()
            schemas = doc.setdefault("components", {}).setdefault("schemas", {})
            for spec in JOB_KINDS.values():
                js = spec.result_schema.model_json_schema(ref_template="#/components/schemas/{model}")
                schemas.update(js.pop("$defs", {}))
                schemas[spec.result_schema.__name__] = js
        return app.openapi_schema  # type: ignore[return-value]

    app.openapi = openapi  # type: ignore[method-assign]
    return app


app = create_app()
