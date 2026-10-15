"""
Demo data (requirements M16). Loaded once, on a database that has no users besides the
bootstrap admin. IDs are fixed but production-style (same random alphabet as ids.new_id), so
screenshots and walkthroughs stay repeatable while looking like real data.

Every seeded account signs in with the password `Password1!`.
"""

import logging
from datetime import UTC, date, datetime, time, timedelta

from app.core import db
from app.core.config import get_settings
from app.core.security import hash_password

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "Password1!"  # nosec B105 - documented demo credential, local/demo data only

# id, username, first, last, title, salary, manager_id (None for managers)
MANAGERS = [
    ("ULMSS7", "priya.natarajan", "Priya", "Natarajan", "Infrastructure Manager", 142000),
    ("WHCV59", "marcus.bell", "Marcus", "Bell", "Digital Products Manager", 138000),
    ("YN2WBZ", "elena.vasquez", "Elena", "Vasquez", "Data Platform Manager", 145000),
]
EMPLOYEES = [
    ("7NW8G4", "john.doe", "John", "Doe", "Systems Engineer", 98000, "ULMSS7"),
    ("DREBQG", "aisha.rahman", "Aisha", "Rahman", "Network Engineer", 102000, "ULMSS7"),
    ("RJN69K", "tomasz.kowalski", "Tomasz", "Kowalski", "Site Reliability Engineer", 110000, "ULMSS7"),
    ("CJQMW3", "grace.oconnor", "Grace", "O'Connor", "Datacenter Technician", 76000, "ULMSS7"),
    ("4X8885", "daniel.kim", "Daniel", "Kim", "Senior Frontend Engineer", 121000, "WHCV59"),
    ("73RVAK", "sofia.reyes", "Sofia", "Reyes", "UX Designer", 95000, "WHCV59"),
    ("4RGC6E", "liam.okafor", "Liam", "Okafor", "Backend Engineer", 108000, "WHCV59"),
    ("86KB5B", "hannah.lindqvist", "Hannah", "Lindqvist", "QA Analyst", 82000, "WHCV59"),
    ("4PZNQC", "noah.haddad", "Noah", "Haddad", "Data Engineer", 115000, "YN2WBZ"),
    ("8EUCPU", "mei.chen", "Mei", "Chen", "Analytics Engineer", 104000, "YN2WBZ"),
    ("K7KZ3K", "lucas.ferreira", "Lucas", "Ferreira", "Database Administrator", 112000, "YN2WBZ"),
    ("FA6N7E", "olivia.bennett", "Olivia", "Bennett", "Junior Data Engineer", 72000, "YN2WBZ"),
]

# id, name, description, budget, start, end, manager, status, archived
PROJECTS = [
    (
        "FLZ38Y",
        "Decommission 1,000 Servers",
        "Retire the legacy on-premise fleet in phased batches: "
        "inventory, migrate workloads, power down, reclaim racks.",
        480000,
        date(2026, 10, 5),
        date(2026, 12, 18),
        "ULMSS7",
        "active",
        False,
    ),
    (
        "5T6FZ2",
        "Customer Portal Redesign",
        "Rebuild the self-service portal with the new design system and accessibility baseline.",
        320000,
        date(2026, 9, 14),
        date(2026, 12, 11),
        "WHCV59",
        "active",
        False,
    ),
    (
        "P2YYU6",
        "Data Warehouse Migration",
        "Move reporting workloads from the legacy warehouse to the cloud lakehouse.",
        275000,
        date(2026, 10, 12),
        date(2027, 1, 29),
        "YN2WBZ",
        "active",
        False,
    ),
    (
        "56WSAB",
        "Legacy VPN Retirement",
        "Replaced the legacy VPN concentrators with zero-trust access. Delivered, awaiting archive.",
        90000,
        date(2026, 6, 1),
        date(2026, 8, 28),
        "WHCV59",
        "complete",
        False,  # finished but not yet archived: the admin dashboard's "Done, not archived" row
    ),
]

# project, user, hours_assigned, is_active, released_reason
MEMBERS = [
    ("FLZ38Y", "7NW8G4", 360, True, None),
    ("FLZ38Y", "DREBQG", 320, True, None),
    ("FLZ38Y", "RJN69K", 280, True, None),
    ("5T6FZ2", "4X8885", 400, True, None),
    ("5T6FZ2", "73RVAK", 300, True, None),
    ("5T6FZ2", "4RGC6E", 380, True, None),
    ("P2YYU6", "4PZNQC", 420, True, None),
    ("P2YYU6", "8EUCPU", 360, True, None),
    ("56WSAB", "86KB5B", 240, False, "completed"),
    ("56WSAB", "4RGC6E", 200, False, "completed"),  # Liam moved on to the portal afterwards
]
# Available (no active project): Grace, Hannah, Lucas, Olivia

# id, project, name, description, start, due, status, sort_order
MILESTONES = [
    (
        "VQ6L33",
        "FLZ38Y",
        "Inventory & tagging",
        "Catalogue every server, owner and workload.",
        date(2026, 10, 5),
        date(2026, 10, 16),
        "complete",
        1,
    ),
    (
        "8LWT5H",
        "FLZ38Y",
        "Migrate workloads — batch 1",
        "Move the first 300 workloads to the new platform.",
        date(2026, 10, 19),
        date(2026, 11, 13),
        "open",
        2,
    ),
    (
        "R2E86D",
        "FLZ38Y",
        "Power-down — batch 1",
        "Shut down and de-rack the first 300 servers.",
        date(2026, 11, 2),
        date(2026, 11, 27),
        "open",
        3,
    ),
    (
        "CWAC8H",
        "FLZ38Y",
        "Migrate workloads — batch 2",
        "Remaining 700 workloads.",
        date(2026, 11, 30),
        date(2026, 12, 18),
        "open",
        4,
    ),
    (
        "VT5FWB",
        "5T6FZ2",
        "Design system adoption",
        "Replace legacy components with the design system.",
        date(2026, 9, 14),
        date(2026, 10, 9),
        "complete",
        1,
    ),
    (
        "2ZJ3R6",
        "5T6FZ2",
        "Account & billing pages",
        "Rebuild the highest-traffic flows.",
        date(2026, 9, 21),
        date(2026, 10, 9),  # slipped: still open past its due date, so the demo shows an "Overdue" cue
        "open",
        2,
    ),
    (
        "BKXFXD",
        "5T6FZ2",
        "Accessibility audit & launch",
        "WCAG 2.2 AA audit, fixes, launch.",
        date(2026, 11, 16),
        date(2026, 12, 11),
        "open",
        3,
    ),
    (
        "VQX63A",
        "P2YYU6",
        "Schema mapping",
        "Map legacy tables to lakehouse models.",
        date(2026, 10, 12),
        date(2026, 10, 17),  # due within the week, so the demo shows a "Due in N days" cue
        "open",
        1,
    ),
    (
        "ZME8H9",
        "P2YYU6",
        "Backfill & validation",
        "Historical load and reconciliation.",
        date(2026, 11, 2),
        date(2027, 1, 29),
        "open",
        2,
    ),
    (
        "2L7UCF",
        "56WSAB",
        "Pilot rollout",
        "Zero-trust pilot for the London office.",
        date(2026, 6, 1),
        date(2026, 7, 10),
        "complete",
        1,
    ),
    (
        "QQRUZE",
        "56WSAB",
        "Global cutover",
        "All regions moved; concentrators decommissioned.",
        date(2026, 7, 13),
        date(2026, 8, 28),
        "complete",
        2,
    ),
]

# milestone, user  — at most one OPEN milestone per user per project (M13a)
ASSIGNEES = [
    ("VQ6L33", "7NW8G4"),
    ("VQ6L33", "DREBQG"),
    ("8LWT5H", "7NW8G4"),
    ("8LWT5H", "DREBQG"),
    ("R2E86D", "RJN69K"),
    ("VT5FWB", "4X8885"),
    ("VT5FWB", "73RVAK"),
    ("2ZJ3R6", "4X8885"),
    ("2ZJ3R6", "4RGC6E"),
    ("BKXFXD", "73RVAK"),
    ("VQX63A", "4PZNQC"),
    ("VQX63A", "8EUCPU"),
    ("2L7UCF", "86KB5B"),
    ("QQRUZE", "86KB5B"),
    ("QQRUZE", "4RGC6E"),
]

# id, milestone, title, assignee, is_done
GOALS = [
    ("3H6WUY", "VQ6L33", "Export CMDB inventory", "7NW8G4", True),
    ("782CTP", "VQ6L33", "Tag servers by workload owner", "DREBQG", True),
    ("QZUTSL", "VQ6L33", "Flag orphaned hosts", "7NW8G4", True),
    ("YTNQWN", "8LWT5H", "Migrate web tier (120 hosts)", "7NW8G4", True),
    ("PQBHWF", "8LWT5H", "Migrate app tier (110 hosts)", "DREBQG", False),
    ("T62Z6L", "8LWT5H", "Migrate batch jobs (70 hosts)", "7NW8G4", False),
    ("RYYJWX", "R2E86D", "Confirm no traffic for 14 days", "RJN69K", False),
    ("4AXNF2", "R2E86D", "Power down and de-rack", "RJN69K", False),
    ("ZBE4EP", "CWAC8H", "Migrate remaining workloads", None, False),
    ("XKC2DX", "VT5FWB", "Replace buttons, inputs, modals", "4X8885", True),
    ("B7URQM", "VT5FWB", "Token-based theming", "73RVAK", True),
    ("5GG43X", "2ZJ3R6", "Account overview page", "4X8885", True),
    ("SLZRMG", "2ZJ3R6", "Billing history page", "4RGC6E", False),
    ("7TBVA4", "2ZJ3R6", "Payment method flow", "4RGC6E", False),
    ("ZCRE6V", "BKXFXD", "Run audit", "73RVAK", False),
    ("L89VEE", "VQX63A", "Map customer domain", "4PZNQC", True),
    ("ECGCCB", "VQX63A", "Map finance domain", "8EUCPU", False),
    ("7GV7ZW", "ZME8H9", "Backfill 5 years of history", None, False),
    ("JX9Y6E", "2L7UCF", "Pilot 50 users", "86KB5B", True),
    ("2L9U9R", "QQRUZE", "Decommission concentrators", "86KB5B", True),
]

# id, project, user, date, hours, note  (dates ≤ 2026-10-13, within each project's range)
TIME_ENTRIES = [
    ("MK89L8", "FLZ38Y", "7NW8G4", date(2026, 10, 5), 8, "Inventory export and clean-up"),
    ("CJD5MC", "FLZ38Y", "7NW8G4", date(2026, 10, 6), 7.5, "Owner tagging"),
    ("3N4C8K", "FLZ38Y", "7NW8G4", date(2026, 10, 7), 8, "Orphan review"),
    ("TMAXV9", "FLZ38Y", "7NW8G4", date(2026, 10, 8), 6, "Web tier migration prep"),
    ("PH7J5S", "FLZ38Y", "DREBQG", date(2026, 10, 5), 8, "Network inventory"),
    ("ZA8LH8", "FLZ38Y", "DREBQG", date(2026, 10, 6), 8, "Tagging"),
    ("RP5725", "FLZ38Y", "DREBQG", date(2026, 10, 9), 4, "App tier planning"),
    ("ZEHGZ9", "FLZ38Y", "RJN69K", date(2026, 10, 7), 8, "Traffic monitoring setup"),
    ("7SMYNP", "FLZ38Y", "RJN69K", date(2026, 10, 8), 8, "Power-down runbook"),
    ("YJQMZC", "5T6FZ2", "4X8885", date(2026, 9, 14), 8, "Design system spike"),
    ("62X3HE", "5T6FZ2", "4X8885", date(2026, 9, 21), 8, "Buttons and inputs"),
    ("4XDMKF", "5T6FZ2", "4X8885", date(2026, 10, 12), 8, "Account overview page"),
    ("6M8T3Q", "5T6FZ2", "73RVAK", date(2026, 9, 15), 7, "Token mapping"),
    ("9YBA65", "5T6FZ2", "73RVAK", date(2026, 10, 1), 6, "Component review"),
    ("AWAN8R", "5T6FZ2", "4RGC6E", date(2026, 10, 12), 8, "Billing history API"),
    ("7ED39X", "5T6FZ2", "4RGC6E", date(2026, 10, 13), 8, "Billing history UI"),
    ("XGCKZ3", "P2YYU6", "4PZNQC", date(2026, 10, 12), 8, "Customer domain mapping"),
    ("B2SYZZ", "P2YYU6", "4PZNQC", date(2026, 10, 13), 8, "Customer domain mapping"),
    ("ZWC3K6", "P2YYU6", "8EUCPU", date(2026, 10, 12), 6, "Finance domain discovery"),
    ("8BEU72", "56WSAB", "86KB5B", date(2026, 6, 2), 8, "Pilot setup"),
    ("3K4SHL", "56WSAB", "86KB5B", date(2026, 7, 20), 8, "Cutover support"),
    ("A8XEHY", "56WSAB", "4RGC6E", date(2026, 8, 10), 8, "Concentrator decommission"),
]


def is_needed(conn) -> bool:
    row = db.query_one("SELECT COUNT(*) AS n FROM users WHERE username <> 'admin'", conn=conn)
    return row is not None and row["n"] == 0


def load(conn=None) -> None:
    """Insert the demo data set in one transaction. Caller checks `is_needed` first."""
    connection = conn or db.get_conn()
    password_hash = hash_password(DEMO_PASSWORD)
    with connection.transaction():
        for uid, username, first, last, title, salary in MANAGERS:
            db.execute(
                """
                INSERT INTO users (id, username, password_hash, first_name, last_name, email, job_title, salary, role)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'manager')
                """,
                (uid, username, password_hash, first, last, f"{username}@example.com", title, salary),
                conn=connection,
            )
        for uid, username, first, last, title, salary, manager_id in EMPLOYEES:
            db.execute(
                """
                INSERT INTO users
                    (id, username, password_hash, first_name, last_name, email, job_title, salary, role, manager_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'employee', %s)
                """,
                (uid, username, password_hash, first, last, f"{username}@example.com", title, salary, manager_id),
                conn=connection,
            )
        for pid, name, description, budget, start, end, manager_id, status, archived in PROJECTS:
            db.execute(
                """
                INSERT INTO projects (id, name, description, budget, start_date, end_date, manager_id, status, archived)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (pid, name, description, budget, start, end, manager_id, status, archived),
                conn=connection,
            )
        for pid, uid, hours, is_active, reason in MEMBERS:
            db.execute(
                """
                INSERT INTO project_members
                    (project_id, user_id, hours_assigned, is_active, released_at, released_reason)
                VALUES (%s, %s, %s, %s, CASE WHEN %s THEN NULL ELSE now() END, %s)
                """,
                (pid, uid, hours, is_active, is_active, reason),
                conn=connection,
            )
        for mid, pid, name, description, start, due, status, order in MILESTONES:
            db.execute(
                """
                INSERT INTO milestones
                    (id, project_id, name, description, start_date, due_date, status, completed_at, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CASE WHEN %s = 'complete' THEN now() END, %s)
                """,
                (mid, pid, name, description, start, due, status, status, order),
                conn=connection,
            )
        milestone_meta = {m[0]: (m[1], m[6]) for m in MILESTONES}
        for mid, uid in ASSIGNEES:
            pid, status = milestone_meta[mid]
            db.execute(
                "INSERT INTO milestone_assignees (milestone_id, user_id, project_id, is_open) VALUES (%s, %s, %s, %s)",
                (mid, uid, pid, status == "open"),
                conn=connection,
            )
        for gid, mid, title, assignee, done in GOALS:
            db.execute(
                """
                INSERT INTO goals (id, milestone_id, title, assignee_id, is_done, done_at)
                VALUES (%s, %s, %s, %s, %s, CASE WHEN %s THEN now() END)
                """,
                (gid, mid, title, assignee, done, done),
                conn=connection,
            )
        for tid, pid, uid, entry_date, hours, note in TIME_ENTRIES:
            db.execute(
                "INSERT INTO time_entries (id, project_id, user_id, entry_date, hours, note) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (tid, pid, uid, entry_date, hours, note),
                conn=connection,
            )
        for row in _audit_trail(connection):
            db.execute(
                "INSERT INTO audit_log (occurred_at, actor_id, actor_role, action, entity_type, entity_id, "
                "project_id, summary, status_code) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                row,
                conn=connection,
            )
    logger.info(
        "Demo data loaded: %d managers, %d employees, %d projects", len(MANAGERS), len(EMPLOYEES), len(PROJECTS)
    )


def _audit_trail(connection) -> list[tuple]:
    """
    The audit rows the seeded facts would have produced had they happened through the API, dated when they
    would have happened, so the admin's "Recent activity" shows business events rather than a wall of
    sign-ins (D25). Same action names and summary shapes as the services write.
    """
    admin = db.query_one("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1", conn=connection)
    admin_id = admin["id"] if admin else None
    names = {uid: f"{first} {last}" for uid, _u, first, last, *_rest in MANAGERS}
    names.update({uid: f"{first} {last}" for uid, _u, first, last, *_rest in EMPLOYEES})
    project_manager = {pid: manager_id for pid, _n, _d, _b, _s, _e, manager_id, _st, _a in PROJECTS}
    project_name = {pid: name for pid, name, *_rest in PROJECTS}
    milestone_project = {mid: pid for mid, pid, *_rest in MILESTONES}
    milestone_name = {mid: name for mid, _pid, name, *_rest in MILESTONES}
    assignee_count = {}
    for mid, _uid in ASSIGNEES:
        assignee_count[mid] = assignee_count.get(mid, 0) + 1

    def at(day, hour, minute=0):
        return datetime.combine(day, time(hour, minute), tzinfo=UTC)

    rows: list[tuple] = []
    for pid, name, _d, _b, start, _end, manager_id, _status, _archived in PROJECTS:
        rows.append(
            (
                at(start - timedelta(days=10), 9),
                admin_id,
                "admin",
                "project.create",
                "project",
                pid,
                pid,
                f"Created project '{name}' (manager {names[manager_id]})",
                201,
            )
        )
    for pid, uid, hours, _active, _reason in MEMBERS:
        start = next(p[4] for p in PROJECTS if p[0] == pid)
        rows.append(
            (
                at(start - timedelta(days=7), 10, 30),
                project_manager[pid],
                "manager",
                "project.member_add",
                "project",
                pid,
                pid,
                f"Added {names[uid]} to the project ({hours:.2f} h assigned)",
                201,
            )
        )
    for mid, pid, name, _d, start, due, status, _order in MILESTONES:
        rows.append(
            (
                at(start - timedelta(days=3), 11),
                project_manager[pid],
                "manager",
                "milestone.create",
                "milestone",
                mid,
                pid,
                f"Created milestone '{name}' ({assignee_count.get(mid, 0)} assignees)",
                201,
            )
        )
        if status == "complete":
            rows.append(
                (
                    at(due, 16, 45),
                    project_manager[pid],
                    "manager",
                    "milestone.complete",
                    "milestone",
                    mid,
                    pid,
                    f"Completed milestone '{name}'",
                    200,
                )
            )
    for tid, pid, uid, entry_date, hours, _note in TIME_ENTRIES:
        rows.append(
            (
                at(entry_date, 17, 30),
                uid,
                "employee",
                "time_entry.create",
                "time_entry",
                tid,
                pid,
                f"{names[uid]} logged {hours:g} h on {entry_date.isoformat()}",
                201,
            )
        )
    for gid, mid, title, assignee, done in GOALS:
        if done and assignee:
            pid = milestone_project[mid]
            rows.append(
                (
                    at(date(2026, 10, 9), 15, 10),
                    assignee,
                    "employee",
                    "goal.update",
                    "goal",
                    gid,
                    pid,
                    f"Completed goal '{title}' on {milestone_name[mid]} ({project_name[pid]})",
                    200,
                )
            )
    # a milestone planned for next month was still *created* around kickoff, and nothing is dated in the future
    cap = datetime.now(UTC) - timedelta(hours=3)
    project_start = {pid: start for pid, _n, _d, _b, start, *_rest in PROJECTS}
    fixed = []
    for row in rows:
        when = row[0]
        if when > cap:
            kickoff = at(project_start[row[6]] - timedelta(days=2), 9) + timedelta(minutes=15 * len(fixed))
            when = min(kickoff, cap)
        fixed.append((when, *row[1:]))
    fixed.sort(key=lambda r: r[0])
    return fixed


def ensure_demo_data(conn=None) -> bool:
    """Load the demo set if enabled and the database only has the bootstrap admin. Returns True if loaded."""
    if not get_settings().seed_demo_data:
        return False
    connection = conn or db.get_conn()
    if not is_needed(connection):
        return False
    load(connection)
    return True
