from typing import Literal

from pydantic import BaseModel, Field, model_validator
from sqlmodel import Session, select

from app.core.errors import InvalidInput
from app.models import Company, Deal, DealFinancials, DiligenceQuestion, Job, RiskFlag, Segment, Teaser

Fraction = Field(ge=0, le=1)
Score = Field(ge=0, le=100)


class TeaserScreenInput(BaseModel):
    text: str = Field(min_length=1, max_length=40_000)


class CompanyIn(BaseModel):
    name: str = Field(min_length=1)
    description: str
    hq: str
    ownership: str
    moat: str


class FinancialsIn(BaseModel):
    revenue: float = Field(gt=0)  # £m
    ebitda: float = Field(gt=0)  # £m
    growth: float = Field(ge=-0.5, le=2)
    recurring_pct: float = Fraction
    capex_pct: float = Fraction
    da_pct: float = Fraction
    nwc_pct: float = Fraction
    top_customer_pct: float = Fraction
    gross_retention: float = Fraction
    cyclicality: Literal["Low", "Medium", "High"]
    ai_resilience: int = Score
    fragmentation: int = Score
    key_person_risk: bool

    @model_validator(mode="after")
    def _ebitda_below_revenue(self) -> "FinancialsIn":
        if self.ebitda >= self.revenue:
            raise ValueError("EBITDA must be below revenue")
        return self


class RiskFlagIn(BaseModel):
    severity: Literal["h", "m", "l"]
    text: str
    mitigant: str


class TeaserScreenResult(BaseModel):
    company: CompanyIn
    segment: str  # a segment's `short` name
    code_name: str
    process: str
    ask_multiple: float | None = Field(default=None, gt=0)
    financials: FinancialsIn
    risk_flags: list[RiskFlagIn] = Field(max_length=8)
    diligence_questions: list[str] = Field(min_length=1, max_length=10)


def persist_teaser_screen(session: Session, job: Job, result: TeaserScreenResult) -> Deal:
    segment = session.exec(select(Segment).where(Segment.short == result.segment)).first()
    if segment is None:
        raise InvalidInput(f"Unknown segment '{result.segment}'")
    company = Company(source="agent", segment_id=segment.id, **result.company.model_dump())
    session.add(company)
    deal = Deal(
        source="agent",
        company_id=company.id,
        code_name=result.code_name,
        stage="Teaser",
        process=result.process,
        ask_multiple=segment.median_multiple if result.ask_multiple is None else result.ask_multiple,
        origin="teaser",
    )
    session.add(deal)
    session.add(DealFinancials(source="agent", deal_id=deal.id, **result.financials.model_dump()))
    session.add_all(RiskFlag(source="agent", deal_id=deal.id, **f.model_dump()) for f in result.risk_flags)
    session.add_all(
        DiligenceQuestion(source="agent", deal_id=deal.id, text=q) for q in result.diligence_questions
    )
    session.add(Teaser(source="agent", raw_text=job.input["text"], job_id=job.id, deal_id=deal.id))
    return deal
