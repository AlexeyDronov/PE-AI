import logging
from typing import Any

from fastapi import FastAPI
from sqlmodel import Session

from app.core.db import write_session
from app.models import Job
from app.models.base import utcnow

logger = logging.getLogger(__name__)

AGENT_UNREACHABLE = "The Copilot agent is not reachable. Try again once it is running."


def create_job(session: Session, kind: str, input: dict[str, Any]) -> Job:
    """Queue a job row inside the caller's transaction."""
    job = Job(kind=kind, status="queued", input=input)
    session.add(job)
    return job


async def publish_job(app: FastAPI, job: Job) -> None:
    """Broadcast the job's current status."""
    await app.state.events.publish({"type": "job", "id": job.id, "kind": job.kind, "status": job.status})


async def dispatch_job(app: FastAPI, job: Job) -> Job:
    """Announce a committed queued job and hand it to the agent service; fail it if unreachable."""
    await publish_job(app, job)
    try:
        await app.state.agent_client.start_job(job.kind, job.id, job.input)
    except Exception:
        logger.exception("Could not start job %s (%s) on the agent service", job.id, job.kind)
        with write_session(app.state.settings.database_path) as session:
            failed = session.get(Job, job.id)
            failed.status = "failed"
            failed.error = AGENT_UNREACHABLE
            failed.updated_at = utcnow()
            session.add(failed)
            session.commit()
            session.refresh(failed)
        await publish_job(app, failed)
        await app.state.events.publish({"type": "changed", "resources": ["jobs"], "ids": [failed.id]})
        return failed
    return job
