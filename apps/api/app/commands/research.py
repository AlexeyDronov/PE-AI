from sqlmodel import Session

from app.jobs.market_research import MarketResearchInput
from app.jobs.runner import create_job
from app.jobs.teaser_screen import TeaserScreenInput
from app.models import Job


def start_market_research(data: MarketResearchInput, session: Session) -> Job:
    return create_job(session, "market_research", data.model_dump())


def screen_teaser(data: TeaserScreenInput, session: Session) -> Job:
    return create_job(session, "teaser_screen", data.model_dump())
