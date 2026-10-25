"""Response models for resources whose rows are enriched with derived values."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app import models as m
from app.compute.lbo import DebtCapacityResponse
from app.services.finance import FundMetrics
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
    metrics: FundMetrics


class KpiPointListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    metric: str
    period: str
    value: float
    company: CompanyRef


class DebtFacilityListItem(DebtFacilityRead):
    company: CompanyRef


class ValueCreationItemListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    lever: str
    amount: float
    company: CompanyRef


class ExitPlanListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    route: str
    buyers: str
    window: str
    company: CompanyRef


class AlertListItem(BaseModel):
    id: str
    created_at: datetime
    company_id: str
    severity: str
    label: str
    text: str
    action: str
    company: CompanyRef


class AnnotationRead(BaseModel):
    id: str
    created_at: datetime
    source: str
    route: str
    selector: str
    note: str
    rect_x: float | None
    rect_y: float | None
    rect_w: float | None
    rect_h: float | None
    viewport_w: int
    viewport_h: int
    theme: str
    status: Literal["open", "resolved"]
    screenshot_path: str | None


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
