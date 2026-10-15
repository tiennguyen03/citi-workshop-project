"""A milestone may wait on one other milestone of its project; no loops, no completing while the blocker is open (D29)."""

import pytest

from app.core.errors import MilestoneBlocked, ValidationError
from app.milestones import service


class ChainRepo:
    def __init__(self):
        self.rows = {
            "M1": {"id": "M1", "project_id": "P1", "name": "Pack", "blocked_by_id": None},
            "M2": {"id": "M2", "project_id": "P1", "name": "Move", "blocked_by_id": "M1"},
            "M3": {"id": "M3", "project_id": "P1", "name": "Unpack", "blocked_by_id": "M2"},
            "X1": {"id": "X1", "project_id": "P2", "name": "Elsewhere", "blocked_by_id": None},
        }

    def find_by_id(self, milestone_id):
        return dict(self.rows[milestone_id]) if milestone_id in self.rows else None


def test_blocker_rules():
    repo = ChainRepo()
    service._assert_blocker("P1", "M3", None, repo)  # clearing the link is always fine
    service._assert_blocker("P1", "M3", "M1", repo)  # further up the same chain is fine
    with pytest.raises(ValidationError, match="itself"):
        service._assert_blocker("P1", "M2", "M2", repo)
    with pytest.raises(ValidationError, match="same project"):
        service._assert_blocker("P1", "M2", "X1", repo)
    with pytest.raises(ValidationError, match="same project"):
        service._assert_blocker("P1", "M2", "NOPE00", repo)
    with pytest.raises(ValidationError, match="loop"):
        service._assert_blocker("P1", "M1", "M3", repo)  # Pack waiting on Unpack closes the loop


def test_completion_refused_while_the_blocker_is_open():
    row = {"id": "M2", "status": "open", "blocked_by_id": "M1", "blocked_by_name": "Pack", "blocked_by_status": "open"}
    with pytest.raises(MilestoneBlocked) as exc:
        service._assert_not_blocked(row)
    assert exc.value.details == {"blockedBy": {"id": "M1", "name": "Pack"}}
    service._assert_not_blocked({**row, "blocked_by_status": "complete"})  # blocker done: free to complete
    service._assert_not_blocked({**row, "blocked_by_id": None})
