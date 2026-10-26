"""Response models for resources whose rows are enriched with derived values."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, model_validator

from app import models as m
from app.compute.lbo import DebtCapacityResponse, Overrides
from app.services.finance import FundMetrics
from app.services.market import Attribute
from app.services.screening import CriterionScore, RiskCheck


class Page[T: BaseModel](BaseModel):
    items: list[T]
    total: int


class CompanyRef(BaseModel):
    name: str
    hq: str
    description: str
    segment_id: str | None


class SegmentRef(BaseModel):
    id: str
    name: str
    short: str
    median_multiple: float


class ScreeningSummary(BaseModel):
    score: int
    verdict: Literal["Advance", "Watch", "Pass"]
    gate_reason: str | None = None


class ScreeningDetail(ScreeningSummary):
    criteria: list[CriterionScore]


class DealListItem(BaseModel):
    id: str
    created_at: datetime
    source: str
    company_id: str
    code_name: str
    stage: str
    process: str
    ask_multiple: float
    origin: str
    company: CompanyRef
    segment: SegmentRef
    financials: m.DealFinancials
    screening: ScreeningSummary
    watchlisted: bool


class DealDetail(DealListItem):
    screening: ScreeningDetail
    risks: list[RiskCheck]
    flags: list[m.RiskFlag]
    questions: list[str]
    debt_capacity: DebtCapacityResponse


class DebtFacilityRead(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    type: str
    pricing: str
    covenant: str
    test_level: float
    actual: float
    interest_cover: float
    cov_lite: bool
    next_test_date: str


class FacilityWithHeadroom(DebtFacilityRead):
    headroom: float


class PortfolioCompanyListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    invest_year: int
    invested: float
    fair_value: float
    revenue: float
    ebitda_ltm: float
    ebitda_budget: float
    net_leverage: float
    status: str
    company: CompanyRef
    segment: SegmentRef
    moic: float
    budget_variance: float
    facility: FacilityWithHeadroom
    status_label: str


class QuarterPoint(BaseModel):
    period: str
    ebitda: float
    ebitda_budget: float


class ValueCreationPoint(BaseModel):
    lever: str
    amount: float


class ExitPlanSummary(BaseModel):
    route: str
    buyers: str
    window: str


class DebtFacilityListItem(FacilityWithHeadroom):
    band: Literal["breach", "tight", "comfortable"]
    company: CompanyRef


class ValueCreationItemListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    lever: str
    amount: float
    company: CompanyRef


class PlatformRef(BaseModel):
    id: str
    moic: float
    fair_value: float
    status: str
    status_label: str


class ExitPlanListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    route: str
    buyers: str
    window: str
    company: CompanyRef
    platform: PlatformRef


class ExitRouteMixListItem(BaseModel):
    id: str
    created_at: datetime
    segment_id: str
    strategic_pct: float
    sponsor_pct: float
    ipo_pct: float
    segment: SegmentRef


class AlertListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    severity: str
    label: str
    text: str
    action: str
    company: CompanyRef


class PortfolioCompanyDetail(PortfolioCompanyListItem):
    quarters: list[QuarterPoint]
    value_creation: list[ValueCreationPoint]
    alerts: list[AlertListItem]
    exit_plan: ExitPlanSummary


class FundWithMetrics(BaseModel):
    id: str
    created_at: datetime
    name: str
    vintage: int
    committed: float
    ebitda_min: float
    ebitda_max: float
    irr_hurdle: float
    max_leverage: float
    hold_years_min: int
    hold_years_max: int
    verdict_advance: float
    verdict_watch: float
    pref_rate: float
    carry: float
    catch_up: float
    as_of: date
    metrics: FundMetrics


class KpiPointListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    metric: str
    period: str
    value: float
    company: CompanyRef


class JobProgress(BaseModel):
    step: str
    message: str
    at: str | None = None


class JobRead(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    source: str
    kind: str
    status: Literal["queued", "running", "succeeded", "failed"]
    input: dict[str, Any]
    progress: list[JobProgress]
    result_ref: str | None
    error: str | None
    usage: dict[str, Any] | None = None


class LboScenarioRead(BaseModel):
    id: str
    deal_id: str
    name: str
    case: Literal["base", "down", "up"]
    overrides: Overrides
    created_at: datetime
    source: str

    @model_validator(mode="before")
    @classmethod
    def _unpack(cls, row: Any) -> Any:
        """Flatten the stored {case, overrides} assumptions onto the row."""
        if isinstance(row, m.LboScenario):
            return {**row.model_dump(exclude={"assumptions"}), **row.assumptions}
        return row


class SegmentListItem(BaseModel):
    id: str
    created_at: datetime
    name: str
    short: str
    market_size: float
    cagr: float
    avg_margin: float
    fragmentation: str
    ai_exposure: str
    median_multiple: float
    addon_multiple: float
    typical_leverage: float
    deal_count_24m: int
    view: str
    white_space: str
    attributes: list[Attribute]
    attractiveness: int
    attractiveness_max: int


class Player(BaseModel):
    id: str
    name: str
    kind: Literal["portfolio", "pipeline"]


class ExitRoutePcts(BaseModel):
    strategic_pct: float
    sponsor_pct: float
    ipo_pct: float


class SegmentDetail(SegmentListItem):
    exit_route_mix: ExitRoutePcts
    transactions: list[m.Transaction]
    players: list[Player]
    matching_deals: list[DealListItem]
    reports: list[m.ResearchReport]


class SourceRef(BaseModel):
    ref: int
    id: str
    url: str
    title: str
    publisher: str
    excerpt: str
    retrieved_at: datetime


class FindingWithRefs(BaseModel):
    id: str
    created_at: datetime
    source: str
    report_id: str
    metric: str
    value: float
    unit: str
    period: str
    confidence: str
    refs: list[int]


class ResearchReportDetail(BaseModel):
    id: str
    created_at: datetime
    source: str
    segment_id: str | None
    question: str
    summary: str
    status: str
    model: str | None
    findings: list[FindingWithRefs]
    sources: list[SourceRef]


class MemoSectionOutline(BaseModel):
    key: str
    label: str
    description: str


class MemoOutline(BaseModel):
    sections: list[MemoSectionOutline]


class MemoSectionRead(BaseModel):
    id: str
    key: str
    label: str
    status: str
    markdown: str


class MemoDetail(BaseModel):
    id: str
    created_at: datetime
    source: str
    deal_id: str
    scenario_id: str | None
    status: str
    scenario_name: str | None
    sections: list[MemoSectionRead]
