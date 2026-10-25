"""Pipeline roll-up: verdict mix, stage funnel and segment strength."""

from collections.abc import Sequence
from statistics import mean, median
from typing import Literal

from pydantic import BaseModel

STAGES = ("Teaser", "NDA", "CIM", "IOI", "LOI", "Exclusivity", "SPA")
VERDICTS = ("Advance", "Watch", "Pass")


class Scored(BaseModel):
    """The slice of an enriched deal the roll-up reads."""

    stage: str
    ask_multiple: float
    segment_id: str
    segment_short: str
    score: int
    verdict: Literal["Advance", "Watch", "Pass"]


class StageCount(BaseModel):
    stage: str
    count: int


class SegmentStrength(BaseModel):
    segment_id: str
    short: str
    count: int
    average_score: float
    best_score: int


class PipelineSummary(BaseModel):
    total: int
    counts: dict[Literal["Advance", "Watch", "Pass"], int]
    average_score: float
    median_ask: float
    by_stage: list[StageCount]
    by_segment: list[SegmentStrength]


def summarise(deals: Sequence[Scored]) -> PipelineSummary:
    """Counts by verdict and stage, score and ask statistics, and per-segment strength."""
    segments: dict[str, list[Scored]] = {}
    for d in deals:
        segments.setdefault(d.segment_id, []).append(d)
    by_segment = [
        SegmentStrength(
            segment_id=segment_id,
            short=group[0].segment_short,
            count=len(group),
            average_score=mean(d.score for d in group),
            best_score=max(d.score for d in group),
        )
        for segment_id, group in segments.items()
    ]
    by_segment.sort(key=lambda s: (-s.count, -s.average_score, s.short))
    return PipelineSummary(
        total=len(deals),
        counts={v: sum(d.verdict == v for d in deals) for v in VERDICTS},
        average_score=mean(d.score for d in deals) if deals else 0.0,
        median_ask=median(d.ask_multiple for d in deals) if deals else 0.0,
        by_stage=[StageCount(stage=s, count=sum(d.stage == s for d in deals)) for s in STAGES],
        by_segment=by_segment,
    )
