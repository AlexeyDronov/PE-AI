from sqlmodel import Session, select

from app.compute.lbo import DealRequest, LboRequest, build_assumptions, checked, load_context
from app.models import Transaction
from app.services import valuation
from app.services.valuation import ValuationRange


def run_valuation_range(data: DealRequest, session: Session) -> ValuationRange:
    ref, ctx = load_context(session, data.deal_id)
    a = build_assumptions(ref, ctx, LboRequest(deal_id=data.deal_id))
    multiples = session.exec(
        select(Transaction.ev_ebitda).where(Transaction.segment_id == ctx.segment.id)
    ).all()
    return checked(
        lambda: valuation.valuation_range(
            a, ctx.deal.ask_multiple, ctx.segment.median_multiple, list(multiples), ref.fund.irr_hurdle
        )
    )
