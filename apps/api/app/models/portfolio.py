from sqlmodel import Field

from app.models.base import Base


class PortfolioCompany(Base, table=True):
    __tablename__ = "portfolio_companies"
    company_id: str = Field(index=True)
    invest_year: int
    invested: float
    fair_value: float
    revenue: float
    ebitda_ltm: float
    ebitda_budget: float
    net_leverage: float
    status: str


class KpiPoint(Base, table=True):
    __tablename__ = "kpi_points"
    company_id: str = Field(index=True)
    metric: str = Field(index=True)
    period: str
    value: float


class DebtFacility(Base, table=True):
    __tablename__ = "debt_facilities"
    company_id: str = Field(index=True)
    type: str
    pricing: str
    covenant: str
    test_level: float
    actual: float
    interest_cover: float
    cov_lite: bool
    next_test_date: str


class ValueCreationItem(Base, table=True):
    __tablename__ = "value_creation_items"
    company_id: str = Field(index=True)
    lever: str
    amount: float


class ExitPlan(Base, table=True):
    __tablename__ = "exit_plans"
    company_id: str = Field(index=True)
    route: str
    buyers: str
    window: str


class Alert(Base, table=True):
    __tablename__ = "alerts"
    company_id: str = Field(index=True)
    severity: str
    label: str
    text: str
    action: str


class FundCashflow(Base, table=True):
    __tablename__ = "fund_cashflows"
    period: int
    calls: float
    distributions: float
    nav: float
