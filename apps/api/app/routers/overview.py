from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app import enrichers
from app import models as m
from app.context import Reference
from app.repositories.repository import Repository
from app.routers.factory import MAX_ROWS, get_read_session
from app.services import market, overview

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/market-summary", response_model=market.MarketSummary)
def market_summary(session: Annotated[Session, Depends(get_read_session)]) -> market.MarketSummary:
    segments = Repository(m.Segment, session).list(limit=MAX_ROWS).items
    reports = Repository(m.ResearchReport, session).list(limit=1).total
    return market.summarise_market(
        [market.SegmentFigures.model_validate(s, from_attributes=True) for s in segments], reports
    )


@router.get("/overview-summary", response_model=overview.OverviewSummary)
def overview_summary(session: Annotated[Session, Depends(get_read_session)]) -> overview.OverviewSummary:
    fund = Reference.load(session).fund
    metrics = enrichers.funds(session, [fund], False)[0].metrics
    deals = enrichers.deals(session, Repository(m.Deal, session).list(limit=MAX_ROWS).items, False)
    alerts = Repository(m.Alert, session).list(limit=MAX_ROWS).items
    return overview.summarise_overview(
        fund.committed,
        fund.vintage,
        fund.as_of.year,
        metrics,
        [d.stage for d in deals],
        [a.severity for a in alerts],
    )
