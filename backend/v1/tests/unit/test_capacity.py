"""The three-pillars arithmetic (D9)."""

from datetime import date
from decimal import Decimal

from app.projects import capacity


def test_working_days_counts_weekdays_inclusive():
    # Mon 2026-10-05 .. Fri 2026-10-09 = 5 ; .. Sun 2026-10-11 still 5 ; .. Mon 2026-10-12 = 6
    assert capacity.working_days(date(2026, 10, 5), date(2026, 10, 9)) == 5
    assert capacity.working_days(date(2026, 10, 5), date(2026, 10, 11)) == 5
    assert capacity.working_days(date(2026, 10, 5), date(2026, 10, 12)) == 6
    assert capacity.working_days(date(2026, 10, 10), date(2026, 10, 11)) == 0  # weekend only
    assert capacity.working_days(date(2026, 10, 12), date(2026, 10, 5)) == 0  # inverted
    assert capacity.working_days(date(2026, 1, 1), date(2026, 12, 31)) == 261


def test_capacity_and_cost():
    start, end = date(2026, 10, 5), date(2026, 10, 16)  # two full weeks
    assert capacity.capacity_hours_per_member(start, end) == Decimal(80)
    assert capacity.project_capacity_hours(start, end, 3) == Decimal(240)
    assert capacity.hourly_rate(104000) == Decimal(50)
    assert capacity.cost_of(Decimal("7.5"), 104000) == Decimal("375.00")
    assert capacity.cost_of(1, 100000) == Decimal("48.08")  # rounded to cents
