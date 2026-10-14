"""Query-string paging shared by every list endpoint (api-contract.md › Conventions › Page)."""

from typing import Any

from app.core.errors import ValidationError

DEFAULT_LIMIT = 25
MAX_LIMIT = 100


def int_param(value: str | None, name: str, default: int, maximum: int | None = None) -> int:
    """A non-negative integer query parameter, or `default` when absent/empty. Out of range → 400 naming the field."""
    if value in (None, ""):
        return default
    try:
        number = int(value)
    except ValueError as exc:
        raise ValidationError(f"{name} must be an integer", field=name) from exc
    if number < 0 or (maximum is not None and number > maximum):
        raise ValidationError(f"{name} must be between 0 and {maximum}", field=name)
    return number


def parse_page(query: dict[str, str], *, default: int = DEFAULT_LIMIT, maximum: int = MAX_LIMIT) -> tuple[int, int]:
    """(limit, offset) from `?limit=&offset=`; a missing or zero limit means the default."""
    limit = int_param(query.get("limit"), "limit", default, maximum) or default
    offset = int_param(query.get("offset"), "offset", 0)
    return limit, offset


def page(items: list[Any], total: int, limit: int, offset: int, **extra: Any) -> dict[str, Any]:
    return {"items": items, "total": total, "limit": limit, "offset": offset, **extra}
