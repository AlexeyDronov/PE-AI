"""The seed builds a deterministic mock 'production' database."""

import sqlite3
from pathlib import Path

from seed.seed import build_database


def rows(path: Path, sql: str) -> list[tuple]:
    with sqlite3.connect(path) as con:
        return con.execute(sql).fetchall()


def count(path: Path, table: str) -> int:
    return rows(path, f"select count(*) from {table}")[0][0]


def test_expected_row_counts(db_path):
    assert count(db_path, "funds") == 1
    assert count(db_path, "segments") == 7
    assert count(db_path, "segment_attribute_scores") == 7 * 6
    assert count(db_path, "exit_route_mixes") == 7
    assert count(db_path, "screening_criteria") == 8
    assert count(db_path, "benchmarks") >= 8
    assert count(db_path, "macro_rates") >= 1
    assert count(db_path, "companies") >= 14
    assert count(db_path, "deals") == 8
    assert count(db_path, "deal_financials") == 8
    assert count(db_path, "risk_flags") >= 8
    assert count(db_path, "diligence_questions") >= 8
    assert count(db_path, "portfolio_companies") == 6
    assert count(db_path, "debt_facilities") == 6
    assert count(db_path, "value_creation_items") >= 6 * 4
    assert count(db_path, "exit_plans") == 6
    assert count(db_path, "alerts") >= 5
    assert count(db_path, "transactions") >= 30
    assert count(db_path, "fund_cashflows") >= 10


def test_kpi_series_has_eight_quarters_of_actual_and_budget_per_platform(db_path):
    got = rows(
        db_path,
        "select metric, count(*) from kpi_points group by company_id, metric order by metric",
    )
    metrics = {m for m, _ in got}
    assert {"ebitda", "ebitda_budget"} <= metrics
    assert all(n == 8 for _, n in got)


def test_screening_weights_sum_to_one(db_path):
    (total,) = rows(db_path, "select round(sum(weight), 6) from screening_criteria")[0]
    assert total == 1.0


def test_writable_tables_start_empty(db_path):
    for table in (
        "annotations",
        "jobs",
        "teasers",
        "watchlist_entries",
        "lbo_scenarios",
        "memos",
        "memo_sections",
        "research_reports",
        "research_findings",
        "sources",
    ):
        assert count(db_path, table) == 0, table


def test_seed_rows_are_marked_as_seed(db_path):
    assert rows(db_path, "select distinct source from deals") == [("seed",)]


def test_reference_values(db_path):
    (ebitda, revenue) = rows(
        db_path,
        "select f.ebitda, f.revenue from deal_financials f join deals d on d.id = f.deal_id "
        "join companies c on c.id = d.company_id where c.name = 'Northvale Compliance'",
    )[0]
    assert (ebitda, revenue) == (14.6, 61.0)
    (committed,) = rows(db_path, "select committed from funds")[0]
    assert committed == 1400.0


def test_seed_is_deterministic(tmp_path):
    a, b = tmp_path / "a.sqlite", tmp_path / "b.sqlite"
    build_database(a)
    build_database(b)
    for table in ("deals", "deal_financials", "kpi_points", "transactions", "fund_cashflows"):
        assert rows(a, f"select * from {table} order by id") == rows(b, f"select * from {table} order by id")


def test_build_replaces_existing_file(tmp_path):
    path = tmp_path / "x.sqlite"
    build_database(path)
    build_database(path)
    assert count(path, "deals") == 8


def test_criteria_targets_describe_what_is_scored(db_path):
    # found in browser review: seeded target labels contradicted the scoring parameters
    got = dict(rows(db_path, "select key, target_text from screening_criteria"))
    assert got == {
        "scale": "£10–60m LTM EBITDA",
        "cash_conversion": "≥ 85% of EBITDA",
        "recurring": "≥ 70% of revenue",
        "margin": "≥ 18%",
        "growth": "≥ 8% a year",
        "moat": "≥ 65 / 100",
        "buy_and_build": "≥ 70 / 100",
        "entry_price": "At or below segment median",
    }


# Found by the 7.7 live memo run: Linden's flag said "above segment median" but its ask was below it.
def test_flags_about_the_segment_median_match_the_numbers(db_path):
    flagged = rows(
        db_path,
        """select f.text, d.code_name, d.ask_multiple, s.median_multiple
           from risk_flags f join deals d on d.id = f.deal_id
           join companies c on c.id = d.company_id join segments s on s.id = c.segment_id
           where lower(f.text) like '%segment median%'""",
    )
    for text, code_name, ask, median in flagged:
        if "above" in text.lower():
            assert ask > median, f"{code_name}: '{text}' but ask {ask}x <= median {median}x"
        if "below" in text.lower():
            assert ask < median, f"{code_name}: '{text}' but ask {ask}x >= median {median}x"
