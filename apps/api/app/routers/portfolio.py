from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app import enrichers
from app import models as m
from app.context import Reference
from app.repositories.repository import Repository
from app.routers.factory import MAX_ROWS, get_read_session
from app.services import portfolio

router = APIRouter(prefix="/api", tags=["portfolio"])


@router.get("/portfolio-summary", response_model=portfolio.PortfolioSummary)
def portfolio_summary(session: Annotated[Session, Depends(get_read_session)]) -> portfolio.PortfolioSummary:
    holdings = Repository(m.PortfolioCompany, session).list(limit=MAX_ROWS).items
    levers = Repository(m.ValueCreationItem, session).list(limit=MAX_ROWS).items
    return portfolio.summarise_portfolio(
        [portfolio.Holding.model_validate(h, from_attributes=True) for h in holdings],
        [portfolio.Lever.model_validate(v, from_attributes=True) for v in levers],
    )


@router.get("/covenant-summary", response_model=portfolio.CovenantSummary)
def covenant_summary(session: Annotated[Session, Depends(get_read_session)]) -> portfolio.CovenantSummary:
    facilities = enrichers.debt_facilities(
        session, Repository(m.DebtFacility, session).list(limit=MAX_ROWS).items, False
    )
    return portfolio.summarise_covenants(
        [
            portfolio.Facility(company=f.company.name, headroom=f.headroom, next_test_date=f.next_test_date)
            for f in facilities
        ],
        Reference.load(session).covenant_comfort,
    )


@router.get("/exit-summary", response_model=portfolio.ExitSummary)
def exit_summary(session: Annotated[Session, Depends(get_read_session)]) -> portfolio.ExitSummary:
    plans = enrichers.exit_plans(session, Repository(m.ExitPlan, session).list(limit=MAX_ROWS).items, False)
    return portfolio.summarise_exits(
        [
            portfolio.ExitPlanInput(route=p.route, status=p.platform.status, fair_value=p.platform.fair_value)
            for p in plans
        ]
    )
