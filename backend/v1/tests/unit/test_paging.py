"""Query-string paging rules shared by the list endpoints."""

import pytest

from app.core.errors import ValidationError
from app.core.paging import DEFAULT_LIMIT, MAX_LIMIT, page, parse_page


def test_parse_page_defaults_and_limits():
    assert parse_page({}) == (DEFAULT_LIMIT, 0)
    assert parse_page({"limit": "", "offset": ""}) == (DEFAULT_LIMIT, 0)
    assert parse_page({"limit": "0"}) == (DEFAULT_LIMIT, 0)
    assert parse_page({"limit": "10", "offset": "30"}) == (10, 30)
    assert parse_page({"limit": str(MAX_LIMIT)}) == (MAX_LIMIT, 0)


@pytest.mark.parametrize("query", [{"limit": "abc"}, {"limit": "-1"}, {"limit": str(MAX_LIMIT + 1)}, {"offset": "-5"}])
def test_parse_page_rejects_bad_values(query):
    with pytest.raises(ValidationError):
        parse_page(query)


def test_page_shape():
    assert page([1, 2], 7, 2, 2, summary=None) == {
        "items": [1, 2],
        "total": 7,
        "limit": 2,
        "offset": 2,
        "summary": None,
    }
