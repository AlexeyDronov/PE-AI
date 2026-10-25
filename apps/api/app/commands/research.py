from sqlmodel import Session

from app.jobs.market_research import MarketResearchInput
from app.jobs.runner import create_job
from app.models import Job


def start_market_research(data: MarketResearchInput, session: Session) -> Job:
    return create_job(session, "market_research", data.model_dump())
