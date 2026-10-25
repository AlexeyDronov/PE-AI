"""One generic read repository, parameterised by model."""

import pytest
from sqlmodel import Session

from app.core.db import read_engine
from app.core.errors import InvalidFilter, NotFound
from app.models import Deal, KpiPoint, Segment
from app.repositories.repository import Page, Repository


@pytest.fixture
def session(db_path):
    with Session(read_engine(db_path)) as s:
        yield s


def test_list_returns_page(session):
    page = Repository(Segment, session).list()
    assert isinstance(page, Page)
    assert page.total == 7
    assert len(page.items) == 7


def test_filters(session):
    page = Repository(Deal, session).list(filters={"stage": "CIM"})
    assert page.total >= 1
    assert all(d.stage == "CIM" for d in page.items)


def test_filters_reject_unknown_columns(session):
    with pytest.raises(InvalidFilter):
        Repository(Deal, session).list(filters={"no_such_column": "x"})


def test_sort_ascending_and_descending(session):
    asc = [s.cagr for s in Repository(Segment, session).list(sort="cagr").items]
    desc = [s.cagr for s in Repository(Segment, session).list(sort="-cagr").items]
    assert asc == sorted(asc)
    assert desc == sorted(desc, reverse=True)


def test_limit_and_offset(session):
    repo = Repository(KpiPoint, session)
    first = repo.list(limit=5, offset=0, sort="id")
    second = repo.list(limit=5, offset=5, sort="id")
    assert first.total == second.total > 10
    assert len(first.items) == 5
    assert {k.id for k in first.items}.isdisjoint({k.id for k in second.items})


def test_get_and_not_found(session):
    seg = Repository(Segment, session).list().items[0]
    assert Repository(Segment, session).get(seg.id).name == seg.name
    with pytest.raises(NotFound):
        Repository(Segment, session).get("missing")
