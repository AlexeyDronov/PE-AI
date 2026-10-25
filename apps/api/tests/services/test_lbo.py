"""LBO engine: a five-year case worked by hand, plus invariants."""

import pytest

from app.services.lbo import (
    LboAssumptions,
    apply_case,
    growth_path,
    max_entry_multiple,
    run_lbo,
    sensitivity,
)

HAND = LboAssumptions(
    revenue0=50.0,
    ebitda0=10.0,
    entry_multiple=10.0,
    exit_multiple=10.0,
    total_leverage=4.0,
    senior_leverage=3.0,
    rate_senior=0.08,
    rate_sub=0.10,
    tx_fee_pct=0.0,
    fin_fee_pct=0.0,
    min_cash=0.0,
    tax_rate=0.25,
    revenue_growth=[0.0] * 5,
    margin_change_bp=0.0,
    capex_pct=0.02,
    da_pct=0.02,
    nwc_pct=0.0,
    sweep=1.0,
    mgmt_rollover=0.0,
)


def test_sources_and_uses_balance():
    r = run_lbo(
        HAND.model_copy(
            update={"tx_fee_pct": 0.02, "fin_fee_pct": 0.025, "min_cash": 2.0, "mgmt_rollover": 0.10}
        )
    )
    su = r.sources_uses
    assert su.enterprise_value == pytest.approx(100.0)
    assert su.transaction_fees == pytest.approx(2.0)
    assert su.financing_fees == pytest.approx(1.0)
    assert su.total_uses == pytest.approx(105.0)
    assert su.senior_debt == pytest.approx(30.0)
    assert su.sub_debt == pytest.approx(10.0)
    assert su.rollover_equity == pytest.approx(6.5)
    assert su.sponsor_equity == pytest.approx(58.5)
    assert su.total_sources == pytest.approx(su.total_uses)


def test_hand_worked_schedule():
    r = run_lbo(HAND)
    years = r.schedule
    assert [y.year for y in years] == [1, 2, 3, 4, 5]
    assert years[0].interest == pytest.approx(3.4)
    assert years[0].tax == pytest.approx(1.4)
    assert years[0].free_cash_flow == pytest.approx(4.2)
    assert years[0].senior_close == pytest.approx(25.8)
    assert years[1].free_cash_flow == pytest.approx(4.452)
    assert years[2].free_cash_flow == pytest.approx(4.71912)
    assert years[3].free_cash_flow == pytest.approx(5.0022672)
    assert years[4].free_cash_flow == pytest.approx(5.302403232)
    assert years[4].senior_close == pytest.approx(6.324209568)
    assert all(y.ebitda == pytest.approx(10.0) for y in years)


def test_hand_worked_returns():
    r = run_lbo(HAND)
    assert r.returns.exit_ev == pytest.approx(100.0)
    assert r.returns.exit_net_debt == pytest.approx(16.324209568)
    assert r.returns.exit_equity == pytest.approx(83.675790432)
    assert r.returns.moic == pytest.approx(83.675790432 / 60.0)
    assert r.returns.irr == pytest.approx((83.675790432 / 60.0) ** 0.2 - 1)


def test_credit_stats():
    r = run_lbo(HAND)
    assert r.credit.total_leverage == pytest.approx(4.0)
    assert r.credit.senior_leverage == pytest.approx(3.0)
    assert r.credit.interest_cover == pytest.approx(10.0 / 3.4)
    assert r.credit.debt_share == pytest.approx(40 / 100)  # debt as a share of total capital


def test_sweep_never_overpays_and_excess_cash_accumulates():
    rich = HAND.model_copy(update={"total_leverage": 1.0, "senior_leverage": 1.0})
    r = run_lbo(rich)
    assert all(y.senior_close >= 0 for y in r.schedule)
    assert r.schedule[-1].senior_close == pytest.approx(0.0)
    assert r.schedule[-1].cash > 0


def test_growth_and_margin_flow_through():
    r = run_lbo(HAND.model_copy(update={"revenue_growth": [0.10] * 5, "margin_change_bp": 100}))
    assert r.schedule[0].revenue == pytest.approx(55.0)
    assert r.schedule[0].margin == pytest.approx(0.21)
    assert r.schedule[0].ebitda == pytest.approx(55.0 * 0.21)
    assert r.schedule[4].revenue == pytest.approx(50 * 1.1**5)


def test_value_bridge_sums_to_equity_gain():
    a = HAND.model_copy(update={"revenue_growth": [0.08] * 5, "exit_multiple": 11.0, "tx_fee_pct": 0.02})
    r = run_lbo(a)
    items = {b.label: b.value for b in r.bridge}
    assert list(items) == [
        "Entry equity",
        "EBITDA growth",
        "Multiple",
        "Debt paydown and cash",
        "Fees",
        "Exit equity",
    ]
    middle = sum(v for k, v in items.items() if k not in {"Entry equity", "Exit equity"})
    assert items["Entry equity"] + middle == pytest.approx(items["Exit equity"])
    assert items["Fees"] == pytest.approx(-2.0)


def test_growth_path_fades_linearly():
    assert growth_path(0.15, 0.07, 5) == pytest.approx([0.15, 0.13, 0.11, 0.09, 0.07])
    assert growth_path(0.05, 0.05, 3) == pytest.approx([0.05, 0.05, 0.05])


def test_cases_order_returns():
    down, base, up = (run_lbo(apply_case(HAND, c)).returns.irr for c in ("down", "base", "up"))
    assert down < base < up
    assert apply_case(HAND, "base") == HAND


def test_sensitivity_grid():
    grid = sensitivity(HAND, entry=[9.0, 10.0, 11.0], exit=[9.0, 10.0, 11.0])
    assert grid.entry == [9.0, 10.0, 11.0]
    assert grid.exit == [9.0, 10.0, 11.0]
    assert len(grid.irr) == 3 and all(len(row) == 3 for row in grid.irr)
    assert grid.irr[1][1] == pytest.approx(run_lbo(HAND).returns.irr)
    for row in grid.irr:
        assert row == sorted(row)  # higher exit, higher IRR
    for j in range(3):
        col = [grid.irr[i][j] for i in range(3)]
        assert col == sorted(col, reverse=True)  # higher entry, lower IRR


def test_max_entry_multiple_hits_the_hurdle():
    m = max_entry_multiple(HAND.model_copy(update={"revenue_growth": [0.10] * 5}), hurdle=0.20)
    r = run_lbo(HAND.model_copy(update={"revenue_growth": [0.10] * 5, "entry_multiple": m}))
    assert r.returns.irr == pytest.approx(0.20, abs=1e-4)


def test_rejects_impossible_structures():
    with pytest.raises(ValueError):
        run_lbo(HAND.model_copy(update={"senior_leverage": 5.0}))  # senior above total
    with pytest.raises(ValueError):
        run_lbo(HAND.model_copy(update={"total_leverage": 11.0}))  # debt above EV
    with pytest.raises(ValueError):
        run_lbo(HAND.model_copy(update={"revenue_growth": [0.0] * 3}))  # path must cover 5 years
