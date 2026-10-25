from typing import Any

from fastapi import FastAPI
from sqlmodel import Session

from app.models import Job


def create_job(session: Session, kind: str, input: dict[str, Any]) -> Job:
    """Queue a job row inside the caller's transaction."""
    job = Job(kind=kind, status="queued", input=input)
    session.add(job)
    return job


async def publish_job(app: FastAPI, job: Job) -> None:
    """Broadcast the job's current status."""
    await app.state.events.publish({"type": "job", "id": job.id, "kind": job.kind, "status": job.status})


async def dispatch_job(app: FastAPI, job: Job) -> None:
    """Announce a committed queued job and hand it to the agent service."""
    await publish_job(app, job)
    await app.state.agent_client.start_job(job.kind, job.id, job.input)
