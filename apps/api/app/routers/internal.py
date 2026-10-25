from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, ValidationError
from sqlmodel import Session

from app.core.db import write_session
from app.core.errors import InvalidInput, JobFinished, NotImplementedYet, Unauthorized
from app.jobs.registry import JOB_KINDS
from app.jobs.runner import publish_job
from app.models import Job
from app.models.base import utcnow
from app.repositories.repository import Repository


def require_service_token(request: Request, authorization: Annotated[str | None, Header()] = None) -> None:
    if authorization != f"Bearer {request.app.state.settings.agent_service_token}":
        raise Unauthorized("Missing or invalid service token")


router = APIRouter(prefix="/internal/jobs", tags=["internal"], dependencies=[Depends(require_service_token)])


class Progress(BaseModel):
    step: str
    message: str


class ResultBody(BaseModel):
    payload: dict[str, Any]


class FailBody(BaseModel):
    error: str


def open_job(session: Session, job_id: str) -> Job:
    job = Repository(Job, session).get(job_id)
    if job.status in ("succeeded", "failed"):
        raise JobFinished(f"Job '{job_id}' is already {job.status}")
    return job


def set_status(job: Job, status: str, **fields: Any) -> None:
    job.status = status
    job.updated_at = utcnow()
    for name, value in fields.items():
        setattr(job, name, value)


@router.post("/{job_id}/progress", status_code=204)
async def progress(job_id: str, body: Progress, request: Request) -> Response:
    app = request.app
    with write_session(app.state.settings.database_path) as session:
        job = open_job(session, job_id)
        set_status(
            job, "running", progress=[*job.progress, {**body.model_dump(), "at": utcnow().isoformat()}]
        )
        session.add(job)
        session.commit()
    await publish_job(app, job)
    return Response(status_code=204)


@router.post("/{job_id}/fail", status_code=204)
async def fail(job_id: str, body: FailBody, request: Request) -> Response:
    app = request.app
    with write_session(app.state.settings.database_path) as session:
        job = open_job(session, job_id)
        set_status(job, "failed", error=body.error)
        session.add(job)
        session.commit()
    await publish_job(app, job)
    return Response(status_code=204)


@router.post("/{job_id}/result", status_code=204)
async def result(job_id: str, body: ResultBody, request: Request) -> Response:
    app = request.app
    with write_session(app.state.settings.database_path) as session:
        job = open_job(session, job_id)
        kind = JOB_KINDS[job.kind]
        try:
            parsed = kind.result_schema.model_validate(body.payload)
        except ValidationError as exc:
            invalid = InvalidInput.from_pydantic(exc)
            set_status(job, "failed", error=f"Invalid result: {invalid.message}")
            session.add(job)
            session.commit()
            await publish_job(app, job)
            raise invalid from exc
        try:
            written = kind.persist(session, job, parsed)
        except NotImplementedError as exc:
            raise NotImplementedYet(str(exc)) from exc
        set_status(job, "succeeded", result_ref=written.id)
        session.add(job)
        session.commit()
    await publish_job(app, job)
    await app.state.events.publish(
        {"type": "changed", "resources": list(kind.invalidates), "ids": [written.id]}
    )
    return Response(status_code=204)
