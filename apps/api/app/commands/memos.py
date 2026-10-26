from typing import Any

from sqlmodel import Session

from app import enrichers
from app.compute.lbo import LboRequest, Overrides, run_lbo, run_sensitivity
from app.core.errors import InvalidInput
from app.jobs.memo_draft import MemoDraftInput
from app.jobs.runner import create_job
from app.models import Company, Deal, Job, LboScenario
from app.repositories.repository import Repository


def _lbo_request(deal_id: str, scenario: LboScenario | None) -> LboRequest:
    if scenario is None:
        return LboRequest(deal_id=deal_id)
    saved = scenario.assumptions
    return LboRequest(deal_id=deal_id, case=saved["case"], overrides=Overrides(**saved["overrides"]))


def build_memo_context(session: Session, deal: Deal, scenario: LboScenario | None) -> dict[str, Any]:
    """A compact, JSON-safe summary of the deal and its model: no year-by-year tables."""
    detail = enrichers.deals(session, [deal], True)[0]
    company = Repository(Company, session).get(deal.company_id)
    request = _lbo_request(deal.id, scenario)
    model = run_lbo(request, session)
    grid = run_sensitivity(request, session)
    flat = [v for row in grid.irr for v in row]
    debt = detail.debt_capacity
    return {
        "deal": {
            "code_name": deal.code_name,
            "company": company.name,
            "segment": detail.segment.name,
            "stage": deal.stage,
            "process": deal.process,
            "ask_multiple": deal.ask_multiple,
            "description": company.description,
            "moat": company.moat,
            "ownership": company.ownership,
        },
        "financials": detail.financials.model_dump(
            mode="json", exclude={"id", "created_at", "source", "deal_id"}
        ),
        "screening": {
            "score": detail.screening.score,
            "verdict": detail.screening.verdict,
            "gate_reason": detail.screening.gate_reason,
            "criteria": [
                c.model_dump(include={"label", "value", "score", "target_text"})
                for c in detail.screening.criteria
            ],
        },
        "flags": [f.model_dump(include={"severity", "text", "mitigant"}) for f in detail.flags],
        "risks": [r.model_dump(include={"label", "status", "detail"}) for r in detail.risks],
        "questions": detail.questions,
        "debt_capacity": debt.model_dump(
            include={"max_leverage", "max_debt", "interest_cover", "stressed_cover"}
        ),
        "lbo": {
            "case": model.case,
            "scenario": scenario.name if scenario else None,
            "assumptions": model.assumptions.model_dump(mode="json"),
            "returns": model.returns.model_dump(),
            "credit": model.credit.model_dump(),
            "hurdle": model.hurdle,
            "max_bid": model.max_bid.model_dump() if model.max_bid else None,
            "sources_uses": model.sources_uses.model_dump(),
        },
        "sensitivity": {"irr_min": min(flat), "irr_max": max(flat), "entry": grid.entry, "exit": grid.exit},
    }


def draft_memo(data: MemoDraftInput, session: Session) -> Job:
    deal = Repository(Deal, session).get(data.deal_id)
    scenario = None
    if data.scenario_id is not None:
        scenario = Repository(LboScenario, session).get(data.scenario_id)
        if scenario.deal_id != deal.id:
            raise InvalidInput("Scenario belongs to a different deal")
    context = build_memo_context(session, deal, scenario)
    return create_job(session, "memo_draft", {**data.model_dump(), "context": context})
