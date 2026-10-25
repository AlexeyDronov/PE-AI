"""Credit, returns and fund maths: pure functions with hand-checked numbers."""

import pytest

from app.services.credit import covenant_headroom, debt_capacity
from app.services.finance import fund_metrics, irr


def test_debt_capacity_matches_hand_calculation():
    d = debt_capacity(
        ebitda=14.6,
        senior_multiple=3.0,
        policy_leverage=4.5,
        rate_senior=0.0875,
        rate_sub=0.11,
        stress_drop=0.225,
        cover_floor=2.0,
    )
    assert d.senior_debt == pytest.approx(43.8)
    assert d.total_debt == pytest.approx(65.7)
    assert d.interest == pytest.approx(6.2415)
    assert d.interest_cover == pytest.approx(2.33918, abs=1e-5)
    assert d.stressed_cover == pytest.approx(1.81287, abs=1e-5)
    assert d.max_leverage == pytest.approx(4.136364, abs=1e-6)
    assert d.max_debt == pytest.approx(60.390909, abs=1e-5)


def test_debt_capacity_max_leverage_hits_the_floor_exactly():
    d = debt_capacity(
        ebitda=20,
        senior_multiple=2.5,
        policy_leverage=5,
        rate_senior=0.09,
        rate_sub=0.12,
        stress_drop=0.2,
        cover_floor=1.8,
    )
    stressed_interest = 20 * (2.5 * 0.09 + (d.max_leverage - 2.5) * 0.12)
    assert 20 * 0.8 / stressed_interest == pytest.approx(1.8)


@pytest.mark.parametrize(
    ("test_level", "actual", "expected"), [(6.0, 5.6, 0.0666667), (5.0, 3.6, 0.28), (4.0, 4.4, -0.1)]
)
def test_covenant_headroom_is_ebitda_cushion(test_level, actual, expected):
    assert covenant_headroom(test_level, actual) == pytest.approx(expected, abs=1e-6)


def test_irr_simple_cases():
    assert irr([-100, 0, 121]) == pytest.approx(0.10, abs=1e-9)
    assert irr([-100, 110]) == pytest.approx(0.10, abs=1e-9)
    assert irr([-100, 10, 10, 110]) == pytest.approx(0.10, abs=1e-9)
    assert irr([-100, 50]) == pytest.approx(-0.5, abs=1e-9)


def test_irr_requires_a_sign_change():
    with pytest.raises(ValueError):
        irr([100, 10])


def test_fund_metrics():
    flows = [
        {"period": "2019", "calls": 100.0, "distributions": 0.0, "nav": 100.0},
        {"period": "2020", "calls": 0.0, "distributions": 0.0, "nav": 110.0},
        {"period": "2021", "calls": 0.0, "distributions": 21.0, "nav": 100.0},
    ]
    m = fund_metrics(flows)
    assert m.called == 100.0
    assert m.distributed == 21.0
    assert m.nav == 100.0
    assert m.dpi == pytest.approx(0.21)
    assert m.tvpi == pytest.approx(1.21)
    # -100 at t0, +21 at t2, NAV 100 treated as a terminal flow at t2
    assert m.net_irr == pytest.approx(0.10, abs=1e-9)
    assert [p.cumulative_net for p in m.series] == [-100.0, -100.0, -79.0]
