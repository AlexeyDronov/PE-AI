"""European distribution waterfall on a hypothetical liquidation — hand-worked numbers."""

import pytest

from app.services.finance import distribution_waterfall

LABELS = ["Return of capital", "Preferred return", "GP catch-up", "Carried interest split"]


def test_full_waterfall_hand_worked():
    # called 100, total value 150, 2 years, 8% compounding pref, 20% carry, 100% catch-up
    tiers = distribution_waterfall(
        called=100, total_value=150, years=2, pref_rate=0.08, carry=0.20, catch_up=1.0
    )
    assert [t.label for t in tiers] == LABELS
    by = {t.label: t for t in tiers}
    pref = 100 * (1.08**2 - 1)  # 16.64
    assert by["Return of capital"].lp == pytest.approx(100) and by["Return of capital"].gp == 0
    assert by["Preferred return"].lp == pytest.approx(pref) and by["Preferred return"].gp == 0
    assert by["GP catch-up"].gp == pytest.approx(pref * 0.25) and by["GP catch-up"].lp == 0
    rest = 150 - 100 - pref - pref * 0.25
    assert by["Carried interest split"].lp == pytest.approx(rest * 0.8)
    assert by["Carried interest split"].gp == pytest.approx(rest * 0.2)
    gp = sum(t.gp for t in tiers)
    assert gp == pytest.approx(0.20 * 50)  # fully caught up: GP holds 20% of profit
    assert sum(t.lp + t.gp for t in tiers) == pytest.approx(150)


def test_below_cost_everything_goes_to_lps():
    tiers = distribution_waterfall(
        called=100, total_value=80, years=3, pref_rate=0.08, carry=0.2, catch_up=1.0
    )
    assert [(t.lp, t.gp) for t in tiers] == [(pytest.approx(80), 0), (0, 0), (0, 0), (0, 0)]


def test_inside_the_pref_no_carry():
    tiers = distribution_waterfall(
        called=100, total_value=110, years=2, pref_rate=0.08, carry=0.2, catch_up=1.0
    )
    assert sum(t.gp for t in tiers) == 0
    assert tiers[1].lp == pytest.approx(10)


def test_partial_catch_up():
    pref = 100 * (1.08**2 - 1)
    tiers = distribution_waterfall(
        called=100, total_value=100 + pref + 2, years=2, pref_rate=0.08, carry=0.2, catch_up=1.0
    )
    assert tiers[2].gp == pytest.approx(2)
    assert tiers[3].lp == 0 and tiers[3].gp == 0
