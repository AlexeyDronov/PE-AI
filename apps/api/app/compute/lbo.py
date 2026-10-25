from collections.abc import Callable
from typing import Literal

from pydantic import BaseModel, ConfigDict
from sqlmodel import Session

from app.context import DealContext, Reference, load_deals
from app.core.errors import InvalidAssumptions
from app.models import Deal
from app.repositories.repository import Repository
from app.services import lbo

SENSITIVITY_STEPS = [-2.0, -1.0, 0.0, 1.0, 2.0]


class Overrides(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry_multiple: float | None = None
    exit_multiple: float | None = None
    total_leverage: float | None = None
    senior_leverage: float | None = None
    growth_y1: float | None = None
    margin_change_bp: float | None = None
    mgmt_rollover: float | None = None
    sweep: float | None = None


class LboRequest(BaseModel):
    deal_id: str
    case: Literal["base", "down", "up"] = "base"
    overrides: Overrides = Overrides()


class DealRequest(BaseModel):
    deal_id: str


class MaxBid(BaseModel):
    multiple: float
    enterprise_value: float


class LboResponse(lbo.LboResult):
    assumptions: lbo.LboAssumptions
    case: str
    hurdle: float
    max_bid: MaxBid | None


class DebtCapacityResponse(BaseModel):
    ebitda: float
    senior_multiple: float
    policy_leverage: float
    rate_senior: float
    rate_sub: float
    stress_drop: float
    cover_floor: float
    senior_debt: float
    total_debt: float
    interest: float
    interest_cover: float
    stressed_cover: float
    max_leverage: float
    max_debt: float


def checked[T](fn: Callable[[], T]) -> T:
    try:
        return fn()
    except ValueError as exc:
        raise InvalidAssumptions(str(exc)) from exc


def load_context(session: Session, deal_id: str) -> tuple[Reference, DealContext]:
    deal = Repository(Deal, session).get(deal_id)
    return Reference.load(session), load_deals(session, [deal])[0]


def build_assumptions(ref: Reference, ctx: DealContext, data: LboRequest) -> lbo.LboAssumptions:
    """Deal facts and fund policy turned into LBO assumptions, with overrides and the case applied."""
    f, o = ctx.financials, data.overrides
    base = lbo.LboAssumptions(
        revenue0=f.revenue,
        ebitda0=f.ebitda,
        entry_multiple=ctx.deal.ask_multiple,
        exit_multiple=ctx.deal.ask_multiple,
        total_leverage=ref.fund.max_leverage,
        senior_leverage=ref.senior_leverage,
        rate_senior=ref.rate_senior,
        rate_sub=ref.rate_sub,
        tx_fee_pct=0.02,
        fin_fee_pct=0.025,
        min_cash=2.0,
        tax_rate=0.25,
        revenue_growth=lbo.growth_path(f.growth if o.growth_y1 is None else o.growth_y1, ctx.segment.cagr, 5),
        margin_change_bp=0.0,
        capex_pct=f.capex_pct,
        da_pct=f.da_pct,
        nwc_pct=f.nwc_pct,
        sweep=0.75,
        mgmt_rollover=0.10,
    )
    direct = o.model_dump(exclude_none=True, exclude={"growth_y1"})
    return lbo.apply_case(base.model_copy(update=direct), data.case)


def run_lbo(data: LboRequest, session: Session) -> LboResponse:
    ref, ctx = load_context(session, data.deal_id)
    a = build_assumptions(ref, ctx, data)
    result = checked(lambda: lbo.run_lbo(a))
    try:
        multiple = lbo.max_entry_multiple(a, ref.fund.irr_hurdle)
        max_bid = MaxBid(multiple=multiple, enterprise_value=multiple * a.ebitda0)
    except ValueError:
        max_bid = None
    return LboResponse(
        **result.model_dump(), assumptions=a, case=data.case, hurdle=ref.fund.irr_hurdle, max_bid=max_bid
    )


def run_sensitivity(data: LboRequest, session: Session) -> lbo.Grid:
    ref, ctx = load_context(session, data.deal_id)
    a = build_assumptions(ref, ctx, data)
    entry = [a.entry_multiple + s for s in SENSITIVITY_STEPS]
    exit_ = [a.exit_multiple + s for s in SENSITIVITY_STEPS]
    return checked(lambda: lbo.sensitivity(a, entry, exit_))


def run_debt_capacity(data: DealRequest, session: Session) -> DebtCapacityResponse:
    ref, ctx = load_context(session, data.deal_id)
    return DebtCapacityResponse(**ref.debt_capacity(ctx.financials.ebitda))
