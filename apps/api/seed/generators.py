"""Deterministic generated series; every function takes its own seeded RNG."""

import random
from datetime import date

QUARTERS = ["2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1", "2026Q2", "2026Q3"]

TARGET_PREFIXES = [
    "Alder",
    "Bexley",
    "Calder",
    "Dunmore",
    "Elmstead",
    "Fenwick",
    "Garrick",
    "Hollin",
    "Ironbridge",
    "Jarrow",
    "Kellan",
    "Larkspur",
    "Marlow",
    "Norbury",
    "Oakhurst",
    "Pennant",
]
TARGET_SUFFIXES = {
    "TIC": ["Testing", "Labs", "Assurance"],
    "Compliance": ["Compliance", "Regulatory", "Advisory"],
    "Payroll BPO": ["Payroll", "Finance Services", "Outsourcing"],
    "IT & cyber": ["Cyber", "Managed IT", "Secure Systems"],
    "Data services": ["Data", "Analytics", "Insight"],
    "Engineering": ["Engineering", "Facilities", "Building Systems"],
    "Legal ops": ["Legal Services", "Contracts", "Legal Ops"],
}
SPONSORS = [
    "Aldgate Partners",
    "Brackenridge Capital",
    "Cinder Equity",
    "Dovecote Partners",
    "Eastwick Capital",
]
STRATEGICS = [
    "Kingsmere Group",
    "Lorimer plc",
    "Meridell Holdings",
    "Northgate Services",
    "Pelham International",
]
ROUTES = ["strategic", "sponsor", "ipo"]


def transactions(rng: random.Random, segments: list[dict]) -> list[dict]:
    """About 40 deals spread over the 24 months to 30 Sep 2026, priced around each segment's multiples."""
    rows = []
    for i in range(40):
        seg = segments[i % len(segments)]
        route = rng.choices(ROUTES, weights=seg["exit"])[0]
        buyers = STRATEGICS if route == "strategic" else SPONSORS
        months_back = rng.randrange(0, 24)
        year, month0 = divmod(2026 * 12 + 8 - months_back, 12)
        when = date(year, month0 + 1, rng.randrange(1, 28))
        multiple = round(seg["median_multiple"] + rng.uniform(-2.5, 2.5), 1)
        ebitda = rng.uniform(6, 55)
        rows.append(
            {
                "date": when,
                "target": f"{rng.choice(TARGET_PREFIXES)} {rng.choice(TARGET_SUFFIXES[seg['short']])}",
                "acquirer": rng.choice(buyers) if route != "ipo" else "Public listing",
                "segment": seg["short"],
                "ev": round(ebitda * multiple, 1),
                "ev_ebitda": multiple,
                "route": route,
            }
        )
    return sorted(rows, key=lambda r: r["date"])


def quarterly_series(rng: random.Random, start: float, end: float) -> list[float]:
    """Eight quarterly values moving from start to end with small noise; the last equals end exactly."""
    steps = len(QUARTERS) - 1
    values = [start + (end - start) * i / steps + rng.uniform(-0.02, 0.02) * start for i in range(steps)]
    return [round(v, 1) for v in values] + [end]


def fund_cashflows(rng: random.Random, committed: float, first_year: int = 2019) -> list[dict]:
    """Yearly calls, distributions and NAV for 2019-2030 with later years as projections."""
    call_share = [0.10, 0.17, 0.16, 0.14, 0.10, 0.07, 0.04, 0.02, 0.02, 0.01, 0.0, 0.0]
    dist_share = [0.0, 0.0, 0.0, 0.01, 0.03, 0.06, 0.10, 0.12, 0.20, 0.28, 0.30, 0.20]
    nav = 0.0
    rows = []
    for i, (c, d) in enumerate(zip(call_share, dist_share, strict=True)):
        calls = round(committed * c, 1)
        dists = round(committed * d * rng.uniform(0.95, 1.05), 1)
        growth = 0.04 if i < 3 else 0.11
        nav = round(max(nav * (1 + growth) + calls - dists, 0.0), 1)
        rows.append({"period": first_year + i, "calls": calls, "distributions": dists, "nav": nav})
    return rows
