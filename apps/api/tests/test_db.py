"""Reads go through a physically read-only connection; writes are fenced to writable tables."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from app.core.db import WRITABLE_TABLES, ReadOnlyViolation, read_engine, write_engine
from app.models import Annotation, Deal, PortfolioCompany, Segment


def test_read_engine_refuses_writes(db_path):
    with read_engine(db_path).connect() as con, pytest.raises(OperationalError):
        con.execute(text("update segments set name = 'x'"))


def test_writable_tables_cover_user_and_agent_data_only():
    assert {
        "annotations",
        "jobs",
        "teasers",
        "deals",
        "deal_financials",
        "risk_flags",
        "diligence_questions",
        "companies",
        "watchlist_entries",
        "lbo_scenarios",
        "memos",
        "memo_sections",
        "research_reports",
        "research_findings",
        "sources",
    } <= WRITABLE_TABLES
    for reference in (
        "funds",
        "segments",
        "segment_attribute_scores",
        "screening_criteria",
        "benchmarks",
        "macro_rates",
        "portfolio_companies",
        "kpi_points",
        "debt_facilities",
        "value_creation_items",
        "exit_plans",
        "alerts",
        "transactions",
        "fund_cashflows",
        "exit_route_mixes",
    ):
        assert reference not in WRITABLE_TABLES


def test_write_session_inserts_into_writable_table(db_path):
    with Session(write_engine(db_path)) as s:
        s.add(
            Annotation(
                route="/deals",
                selector="[data-testid=x]",
                note="Too dense",
                viewport_w=1440,
                viewport_h=900,
                theme="light",
            )
        )
        s.commit()
    with Session(read_engine(db_path)) as s:
        assert len(s.exec(select(Annotation)).all()) == 1


def test_write_session_refuses_reference_tables(db_path):
    with Session(write_engine(db_path)) as s:
        seg = s.exec(select(Segment)).first()
        seg.name = "Changed"
        with pytest.raises(ReadOnlyViolation):
            s.commit()


def test_write_session_refuses_portfolio_inserts(db_path):
    with Session(write_engine(db_path)) as s:
        s.add(
            PortfolioCompany(
                company_id="c1",
                invest_year=2025,
                invested=1,
                fair_value=1,
                revenue=1,
                ebitda_ltm=1,
                ebitda_budget=1,
                net_leverage=1,
                status="good",
            )
        )
        with pytest.raises(ReadOnlyViolation):
            s.commit()


def test_write_session_refuses_changing_seed_rows_in_writable_tables(db_path):
    with Session(write_engine(db_path)) as s:
        deal = s.exec(select(Deal)).first()
        assert deal.source == "seed"
        deal.ask_multiple = 1.0
        with pytest.raises(ReadOnlyViolation):
            s.commit()
    with Session(write_engine(db_path)) as s:
        deal = s.exec(select(Deal)).first()
        s.delete(deal)
        with pytest.raises(ReadOnlyViolation):
            s.commit()
