"""Debt capacity and covenant maths."""

from pydantic import BaseModel


class DebtCapacity(BaseModel):
    senior_debt: float
    total_debt: float
    interest: float
    interest_cover: float
    stressed_cover: float
    max_leverage: float
    max_debt: float


def debt_capacity(
    ebitda: float,
    senior_multiple: float,
    policy_leverage: float,
    rate_senior: float,
    rate_sub: float,
    stress_drop: float,
    cover_floor: float,
) -> DebtCapacity:
    """Debt at policy leverage, its cover, and the leverage that just holds the stressed cover floor."""
    senior = senior_multiple * ebitda
    total = policy_leverage * ebitda
    interest = senior * rate_senior + (total - senior) * rate_sub
    max_leverage = (
        senior_multiple + ((1 - stress_drop) / cover_floor - senior_multiple * rate_senior) / rate_sub
    )
    return DebtCapacity(
        senior_debt=senior,
        total_debt=total,
        interest=interest,
        interest_cover=ebitda / interest,
        stressed_cover=ebitda * (1 - stress_drop) / interest,
        max_leverage=max_leverage,
        max_debt=max_leverage * ebitda,
    )


def covenant_headroom(test_level: float, actual: float) -> float:
    """EBITDA cushion before the covenant test level is breached."""
    return 1 - actual / test_level
