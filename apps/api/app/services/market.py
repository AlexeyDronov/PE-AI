"""Market roll-up: segment attractiveness and the cross-segment headline figures."""

from collections.abc import Sequence
from statistics import median

from pydantic import BaseModel

ATTRIBUTES = (
    "Non-cyclical",
    "Contracted / recurring",
    "Technical moat",
    "Synergy potential",
    "Industry tailwinds",
    "Fragmented / local",
)
MAX_SCORE = 3


class Attribute(BaseModel):
    attribute: str
    score: int


class SegmentFigures(BaseModel):
    """The slice of a segment the roll-up reads."""

    market_size: float
    median_multiple: float
    deal_count_24m: int


class MarketSummary(BaseModel):
    segments: int
    profit_pool: float
    median_multiple: float
    deals_24m: int
    reports: int


def order_attributes(scores: Sequence[Attribute]) -> list[Attribute]:
    """Attribute scores in the fixed display order."""
    return sorted(scores, key=lambda a: ATTRIBUTES.index(a.attribute))


def attractiveness(scores: Sequence[Attribute]) -> tuple[int, int]:
    """Total score and the maximum possible."""
    return sum(a.score for a in scores), MAX_SCORE * len(ATTRIBUTES)


def summarise_market(segments: Sequence[SegmentFigures], reports: int) -> MarketSummary:
    """Total market size, median of segment multiples, 24-month deal count and research report count."""
    return MarketSummary(
        segments=len(segments),
        profit_pool=sum(s.market_size for s in segments),
        median_multiple=median(s.median_multiple for s in segments) if segments else 0.0,
        deals_24m=sum(s.deal_count_24m for s in segments),
        reports=reports,
    )
