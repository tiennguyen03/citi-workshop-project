"""The pure parts of the dashboard: attention reasons and week bounds."""

from datetime import date
from decimal import Decimal

import pytest

from app.dashboard.service import _attention_reasons, _week_bounds

TODAY = date(2026, 10, 14)


def card(**overrides):
    base = {
        "status": "active",
        "endDate": date(2026, 12, 18),
        "memberCount": 3,
        "milestoneCounts": {"open": 2, "complete": 1},
        "nextDueDate": date(2026, 11, 13),
        "budgetRemaining": Decimal("100"),
    }
    return {**base, **overrides}


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({}, []),
        ({"budgetRemaining": Decimal("-1")}, ["over_budget"]),
        ({"endDate": date(2026, 10, 13)}, ["past_end"]),
        ({"nextDueDate": date(2026, 10, 13)}, ["overdue_milestone"]),
        ({"nextDueDate": date(2026, 10, 14)}, []),  # due today is not overdue
        ({"nextDueDate": None, "milestoneCounts": {"open": 0, "complete": 1}}, []),
        ({"memberCount": 0}, ["no_members"]),
        ({"nextDueDate": None, "milestoneCounts": {"open": 0, "complete": 0}}, ["no_milestones"]),
        (
            {
                "budgetRemaining": Decimal("-1"),
                "endDate": date(2026, 1, 1),
                "nextDueDate": date(2026, 1, 2),
                "memberCount": 0,
            },
            ["over_budget", "past_end", "overdue_milestone", "no_members"],
        ),
        # a completed project is never "past end", "overdue" or "empty" — only money still matters
        ({"status": "complete", "endDate": date(2026, 1, 1), "memberCount": 0, "nextDueDate": date(2026, 1, 1)}, []),
        ({"status": "complete", "budgetRemaining": Decimal("-5")}, ["over_budget"]),
    ],
)
def test_attention_reasons(overrides, expected):
    assert _attention_reasons(card(**overrides), TODAY) == expected


def test_week_bounds_are_monday_to_sunday():
    assert _week_bounds(date(2026, 10, 14)) == (date(2026, 10, 12), date(2026, 10, 18))  # Wednesday
    assert _week_bounds(date(2026, 10, 12)) == (date(2026, 10, 12), date(2026, 10, 18))  # Monday
    assert _week_bounds(date(2026, 10, 18)) == (date(2026, 10, 12), date(2026, 10, 18))  # Sunday
