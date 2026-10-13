"""
The three-pillars arithmetic (decisions.md D9). The only place these formulas live.

- capacity per member = weekdays between start and end (inclusive) × 8 h  (a 40 h week)
- project capacity    = capacity per member × number of members
- hourly cost         = annual salary / 2080  (52 weeks × 40 h)
- cost consumed       = hours completed × hourly cost
"""

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

HOURS_PER_DAY = Decimal(8)
HOURS_PER_YEAR = Decimal(2080)
CENTS = Decimal("0.01")


def working_days(start: date, end: date) -> int:
    """Number of Monday–Friday days from `start` to `end` inclusive. 0 if end < start."""
    if end < start:
        return 0
    days = (end - start).days + 1
    full_weeks, remainder = divmod(days, 7)
    count = full_weeks * 5
    for offset in range(remainder):
        if (start + timedelta(days=offset)).weekday() < 5:
            count += 1
    return count


def capacity_hours_per_member(start: date, end: date) -> Decimal:
    return Decimal(working_days(start, end)) * HOURS_PER_DAY


def project_capacity_hours(start: date, end: date, member_count: int) -> Decimal:
    return capacity_hours_per_member(start, end) * Decimal(member_count)


def hourly_rate(salary: Decimal | int | float) -> Decimal:
    return Decimal(salary) / HOURS_PER_YEAR


def cost_of(hours: Decimal | int | float, salary: Decimal | int | float) -> Decimal:
    """Money consumed by `hours` of a person paid `salary` per year, rounded to cents."""
    return (Decimal(hours) * hourly_rate(salary)).quantize(CENTS, rounding=ROUND_HALF_UP)
