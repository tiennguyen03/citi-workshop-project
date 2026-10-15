"""Work completion is goals done over goals that exist (D27); no goals is "not configured", not 0 %."""

from app.projects.schemas import goal_progress


def test_no_goals_is_unconfigured_not_zero():
    assert goal_progress({"goals_total": 0, "goals_done": 0}) == {
        "completedGoals": 0,
        "totalGoals": 0,
        "progressPercent": None,
    }


def test_partial_and_complete_and_rounding():
    assert goal_progress({"goals_total": 3, "goals_done": 1})["progressPercent"] == 33
    assert goal_progress({"goals_total": 3, "goals_done": 2})["progressPercent"] == 67
    assert goal_progress({"goals_total": 8, "goals_done": 4}) == {
        "completedGoals": 4,
        "totalGoals": 8,
        "progressPercent": 50,
    }
    assert goal_progress({"goals_total": 5, "goals_done": 5})["progressPercent"] == 100
    assert goal_progress({"goals_total": 10, "goals_done": 0})["progressPercent"] == 0  # work exists, none done
