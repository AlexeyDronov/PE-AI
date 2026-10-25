from datetime import date

from sqlmodel import Field

from app.models.base import Base


class Fund(Base, table=True):
    __tablename__ = "funds"
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


class Benchmark(Base, table=True):
    __tablename__ = "benchmarks"
    key: str = Field(index=True)
    label: str
    low: float
    high: float | None = None
    unit: str
    source_note: str


class MacroRate(Base, table=True):
    __tablename__ = "macro_rates"
    key: str = Field(index=True)
    value: float
    as_of: date


class ScreeningCriterion(Base, table=True):
    __tablename__ = "screening_criteria"
    key: str = Field(index=True)
    label: str
    weight: float
    metric: str
    kind: str
    target_text: str
    floor: float
    ceiling: float
