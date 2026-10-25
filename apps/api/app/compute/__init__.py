from app.compute.lbo import DealRequest, LboRequest, run_debt_capacity, run_lbo, run_sensitivity
from app.compute.spec import ComputeSpec
from app.compute.valuation import run_valuation_range

COMPUTES: list[ComputeSpec] = [
    ComputeSpec("lbo", LboRequest, run_lbo),
    ComputeSpec("lbo-sensitivity", LboRequest, run_sensitivity),
    ComputeSpec("debt-capacity", DealRequest, run_debt_capacity),
    ComputeSpec("valuation-range", DealRequest, run_valuation_range),
]
