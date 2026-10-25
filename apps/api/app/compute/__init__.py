from app.compute.lbo import DealRequest, LboRequest, run_debt_capacity, run_lbo, run_sensitivity
from app.compute.spec import ComputeSpec

COMPUTES: list[ComputeSpec] = [
    ComputeSpec("lbo", LboRequest, run_lbo),
    ComputeSpec("lbo-sensitivity", LboRequest, run_sensitivity),
    ComputeSpec("debt-capacity", DealRequest, run_debt_capacity),
]
