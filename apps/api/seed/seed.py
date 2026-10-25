"""Builds the deterministic mock database: `python -m seed.seed`."""

import hashlib
import random
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml
from sqlmodel import Session as SqlSession
from sqlmodel import SQLModel, create_engine
from ulid import ULID

from app import models as m
from app.core.config import Settings
from seed import generators

FIXTURES = Path(__file__).parent / "fixtures"
SEED_TIME = datetime(2026, 10, 1, tzinfo=UTC)
RNG_SEED = 20261001


def sid(*parts: str) -> str:
    """Deterministic ULID derived from a stable key."""
    return str(ULID.from_bytes(hashlib.sha256("|".join(parts).encode()).digest()[:16]))


def load(name: str) -> Any:
    return yaml.safe_load((FIXTURES / name).read_text())


def row(model: type, *key: str, **fields: Any):
    """Instantiate a seed row with a fixed id and timestamp (and source='seed' where applicable)."""
    extra = {"source": "seed"} if "source" in model.model_fields else {}
    return model(id=sid(model.__tablename__, *key), created_at=SEED_TIME, **extra, **fields)


def _reference(reference: dict) -> list:
    fund = reference["fund"]
    rows = [row(m.Fund, fund["name"], **fund)]
    rows += [row(m.ScreeningCriterion, c["key"], **c) for c in reference["criteria"]]
    rows += [row(m.Benchmark, b["key"], **b) for b in reference["benchmarks"]]
    rows += [row(m.MacroRate, r["key"], **r) for r in reference["macro_rates"]]
    return rows


def _segments(segments: list[dict], attributes: list[str]) -> list:
    rows = []
    for s in segments:
        sg = row(m.Segment, s["short"], **{k: s[k] for k in m.Segment.model_fields if k in s})
        rows.append(sg)
        rows += [
            row(m.SegmentAttributeScore, s["short"], attr, segment_id=sg.id, attribute=attr, score=score)
            for attr, score in zip(attributes, s["scores"], strict=True)
        ]
        strategic, sponsor, ipo = s["exit"]
        rows.append(
            row(
                m.ExitRouteMix,
                s["short"],
                segment_id=sg.id,
                strategic_pct=strategic,
                sponsor_pct=sponsor,
                ipo_pct=ipo,
            )
        )
    return rows


def _company(entry: dict) -> m.Company:
    fields = {k: entry[k] for k in ("name", "description", "hq", "ownership", "moat")}
    return row(m.Company, entry["name"], segment_id=sid("segments", entry["segment"]), **fields)


def _deals(deals: list[dict]) -> list:
    rows = []
    fin_fields = [
        f for f in m.DealFinancials.model_fields if f not in {"id", "created_at", "source", "deal_id"}
    ]
    for d in deals:
        company = _company(d)
        deal = row(
            m.Deal,
            d["name"],
            company_id=company.id,
            code_name=d["code_name"],
            stage=d["stage"],
            process=d["process"],
            ask_multiple=d["ask_multiple"],
            origin="seed",
        )
        rows += [company, deal]
        rows.append(row(m.DealFinancials, d["name"], deal_id=deal.id, **{f: d[f] for f in fin_fields}))
        rows += [row(m.RiskFlag, d["name"], r["text"], deal_id=deal.id, **r) for r in d["risks"]]
        rows += [row(m.DiligenceQuestion, d["name"], q, deal_id=deal.id, text=q) for q in d["questions"]]
    return rows


def _portfolio(companies: list[dict], alerts: list[dict], rng: random.Random) -> list:
    rows = []
    for p in companies:
        company = _company(p)
        rows.append(company)
        rows.append(
            row(
                m.PortfolioCompany,
                p["name"],
                company_id=company.id,
                **{
                    k: p[k]
                    for k in (
                        "invest_year",
                        "invested",
                        "fair_value",
                        "revenue",
                        "ebitda_ltm",
                        "ebitda_budget",
                        "net_leverage",
                        "status",
                    )
                },
            )
        )
        for metric, end in (("ebitda", p["ebitda_ltm"]), ("ebitda_budget", p["ebitda_budget"])):
            start = end * rng.uniform(0.82, 1.1)
            for period, value in zip(
                generators.QUARTERS, generators.quarterly_series(rng, start, end), strict=True
            ):
                rows.append(
                    row(
                        m.KpiPoint,
                        p["name"],
                        metric,
                        period,
                        company_id=company.id,
                        metric=metric,
                        period=period,
                        value=value,
                    )
                )
        rows.append(row(m.DebtFacility, p["name"], company_id=company.id, **p["debt"]))
        rows += [
            row(m.ValueCreationItem, p["name"], v["lever"], company_id=company.id, **v)
            for v in p["value_creation"]
        ]
        rows.append(row(m.ExitPlan, p["name"], company_id=company.id, **p["exit"]))
    for a in alerts:
        rows.append(
            row(
                m.Alert,
                a["company"],
                a["label"],
                company_id=sid("companies", a["company"]),
                **{k: a[k] for k in ("severity", "label", "text", "action")},
            )
        )
    return rows


def _market(rng: random.Random, segments: list[dict]) -> list:
    return [
        row(
            m.Transaction,
            str(i),
            segment_id=sid("segments", t["segment"]),
            **{k: t[k] for k in ("date", "target", "acquirer", "ev", "ev_ebitda", "route")},
        )
        for i, t in enumerate(generators.transactions(rng, segments))
    ]


def _cashflows(rng: random.Random, committed: float) -> list:
    return [row(m.FundCashflow, str(c["period"]), **c) for c in generators.fund_cashflows(rng, committed)]


def build_database(path: Path) -> None:
    """Delete any existing file at `path` and create a freshly seeded database."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    rng = random.Random(RNG_SEED)
    reference, segments = load("reference.yaml"), load("segments.yaml")
    rows = [
        *_reference(reference),
        *_segments(segments, reference["segment_attributes"]),
        *_market(rng, segments),
        *_deals(load("deals.yaml")),
        *_portfolio(load("portfolio.yaml"), load("alerts.yaml"), rng),
        *_cashflows(rng, reference["fund"]["committed"]),
    ]
    engine = create_engine(f"sqlite:///{path}")
    SQLModel.metadata.create_all(engine)
    with SqlSession(engine) as session:
        session.add_all(rows)
        session.commit()
    engine.dispose()


if __name__ == "__main__":
    build_database(Settings().database_path)
