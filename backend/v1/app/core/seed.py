"""
Demo data (requirements M16). Loaded once, on a database that has no users besides the
bootstrap admin. Deterministic IDs so screenshots and walkthroughs are repeatable.

Every seeded account signs in with the password `Password1!`.
"""

import logging
from datetime import date

from app.core import db
from app.core.config import get_settings
from app.core.security import hash_password

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "Password1!"  # nosec B105 - documented demo credential, local/demo data only

# id, username, first, last, title, salary, manager_id (None for managers)
MANAGERS = [
    ("MGR001", "priya.natarajan", "Priya", "Natarajan", "Infrastructure Manager", 142000),
    ("MGR002", "marcus.bell", "Marcus", "Bell", "Digital Products Manager", 138000),
    ("MGR003", "elena.vasquez", "Elena", "Vasquez", "Data Platform Manager", 145000),
]
EMPLOYEES = [
    ("EMP001", "john.doe", "John", "Doe", "Systems Engineer", 98000, "MGR001"),
    ("EMP002", "aisha.rahman", "Aisha", "Rahman", "Network Engineer", 102000, "MGR001"),
    ("EMP003", "tomasz.kowalski", "Tomasz", "Kowalski", "Site Reliability Engineer", 110000, "MGR001"),
    ("EMP004", "grace.oconnor", "Grace", "O'Connor", "Datacenter Technician", 76000, "MGR001"),
    ("EMP005", "daniel.kim", "Daniel", "Kim", "Senior Frontend Engineer", 121000, "MGR002"),
    ("EMP006", "sofia.reyes", "Sofia", "Reyes", "UX Designer", 95000, "MGR002"),
    ("EMP007", "liam.okafor", "Liam", "Okafor", "Backend Engineer", 108000, "MGR002"),
    ("EMP008", "hannah.lindqvist", "Hannah", "Lindqvist", "QA Analyst", 82000, "MGR002"),
    ("EMP009", "noah.haddad", "Noah", "Haddad", "Data Engineer", 115000, "MGR003"),
    ("EMP010", "mei.chen", "Mei", "Chen", "Analytics Engineer", 104000, "MGR003"),
    ("EMP011", "lucas.ferreira", "Lucas", "Ferreira", "Database Administrator", 112000, "MGR003"),
    ("EMP012", "olivia.bennett", "Olivia", "Bennett", "Junior Data Engineer", 72000, "MGR003"),
]

# id, name, description, budget, start, end, manager, status, archived
PROJECTS = [
    (
        "PRJ001",
        "Decommission 1,000 Servers",
        "Retire the legacy on-premise fleet in phased batches: "
        "inventory, migrate workloads, power down, reclaim racks.",
        480000,
        date(2026, 10, 5),
        date(2026, 12, 18),
        "MGR001",
        "active",
        False,
    ),
    (
        "PRJ002",
        "Customer Portal Redesign",
        "Rebuild the self-service portal with the new design system and accessibility baseline.",
        320000,
        date(2026, 9, 14),
        date(2026, 12, 11),
        "MGR002",
        "active",
        False,
    ),
    (
        "PRJ003",
        "Data Warehouse Migration",
        "Move reporting workloads from the legacy warehouse to the cloud lakehouse.",
        275000,
        date(2026, 10, 12),
        date(2027, 1, 29),
        "MGR003",
        "active",
        False,
    ),
    (
        "PRJ004",
        "Legacy VPN Retirement",
        "Replaced the legacy VPN concentrators with zero-trust access. Delivered and archived.",
        90000,
        date(2026, 6, 1),
        date(2026, 8, 28),
        "MGR002",
        "complete",
        True,
    ),
]

# project, user, hours_assigned, is_active, released_reason
MEMBERS = [
    ("PRJ001", "EMP001", 360, True, None),
    ("PRJ001", "EMP002", 320, True, None),
    ("PRJ001", "EMP003", 280, True, None),
    ("PRJ002", "EMP005", 400, True, None),
    ("PRJ002", "EMP006", 300, True, None),
    ("PRJ002", "EMP007", 380, True, None),
    ("PRJ003", "EMP009", 420, True, None),
    ("PRJ003", "EMP010", 360, True, None),
    ("PRJ004", "EMP008", 240, False, "completed"),
    ("PRJ004", "EMP007", 200, False, "completed"),  # Liam moved on to the portal afterwards
]
# Available (no active project): EMP004 Grace, EMP008 Hannah, EMP011 Lucas, EMP012 Olivia

# id, project, name, description, start, due, status, sort_order
MILESTONES = [
    (
        "MIL001",
        "PRJ001",
        "Inventory & tagging",
        "Catalogue every server, owner and workload.",
        date(2026, 10, 5),
        date(2026, 10, 16),
        "complete",
        1,
    ),
    (
        "MIL002",
        "PRJ001",
        "Migrate workloads — batch 1",
        "Move the first 300 workloads to the new platform.",
        date(2026, 10, 19),
        date(2026, 11, 13),
        "open",
        2,
    ),
    (
        "MIL003",
        "PRJ001",
        "Power-down — batch 1",
        "Shut down and de-rack the first 300 servers.",
        date(2026, 11, 2),
        date(2026, 11, 27),
        "open",
        3,
    ),
    (
        "MIL004",
        "PRJ001",
        "Migrate workloads — batch 2",
        "Remaining 700 workloads.",
        date(2026, 11, 30),
        date(2026, 12, 18),
        "open",
        4,
    ),
    (
        "MIL005",
        "PRJ002",
        "Design system adoption",
        "Replace legacy components with the design system.",
        date(2026, 9, 14),
        date(2026, 10, 9),
        "complete",
        1,
    ),
    (
        "MIL006",
        "PRJ002",
        "Account & billing pages",
        "Rebuild the highest-traffic flows.",
        date(2026, 10, 12),
        date(2026, 11, 13),
        "open",
        2,
    ),
    (
        "MIL007",
        "PRJ002",
        "Accessibility audit & launch",
        "WCAG 2.2 AA audit, fixes, launch.",
        date(2026, 11, 16),
        date(2026, 12, 11),
        "open",
        3,
    ),
    (
        "MIL008",
        "PRJ003",
        "Schema mapping",
        "Map legacy tables to lakehouse models.",
        date(2026, 10, 12),
        date(2026, 10, 30),
        "open",
        1,
    ),
    (
        "MIL009",
        "PRJ003",
        "Backfill & validation",
        "Historical load and reconciliation.",
        date(2026, 11, 2),
        date(2027, 1, 29),
        "open",
        2,
    ),
    (
        "MIL010",
        "PRJ004",
        "Pilot rollout",
        "Zero-trust pilot for the London office.",
        date(2026, 6, 1),
        date(2026, 7, 10),
        "complete",
        1,
    ),
    (
        "MIL011",
        "PRJ004",
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
    ("MIL001", "EMP001"),
    ("MIL001", "EMP002"),
    ("MIL002", "EMP001"),
    ("MIL002", "EMP002"),
    ("MIL003", "EMP003"),
    ("MIL005", "EMP005"),
    ("MIL005", "EMP006"),
    ("MIL006", "EMP005"),
    ("MIL006", "EMP007"),
    ("MIL007", "EMP006"),
    ("MIL008", "EMP009"),
    ("MIL008", "EMP010"),
    ("MIL010", "EMP008"),
    ("MIL011", "EMP008"),
    ("MIL011", "EMP007"),
]

# id, milestone, title, assignee, is_done
GOALS = [
    ("GOL001", "MIL001", "Export CMDB inventory", "EMP001", True),
    ("GOL002", "MIL001", "Tag servers by workload owner", "EMP002", True),
    ("GOL003", "MIL001", "Flag orphaned hosts", "EMP001", True),
    ("GOL004", "MIL002", "Migrate web tier (120 hosts)", "EMP001", True),
    ("GOL005", "MIL002", "Migrate app tier (110 hosts)", "EMP002", False),
    ("GOL006", "MIL002", "Migrate batch jobs (70 hosts)", "EMP001", False),
    ("GOL007", "MIL003", "Confirm no traffic for 14 days", "EMP003", False),
    ("GOL008", "MIL003", "Power down and de-rack", "EMP003", False),
    ("GOL009", "MIL004", "Migrate remaining workloads", None, False),
    ("GOL010", "MIL005", "Replace buttons, inputs, modals", "EMP005", True),
    ("GOL011", "MIL005", "Token-based theming", "EMP006", True),
    ("GOL012", "MIL006", "Account overview page", "EMP005", True),
    ("GOL013", "MIL006", "Billing history page", "EMP007", False),
    ("GOL014", "MIL006", "Payment method flow", "EMP007", False),
    ("GOL015", "MIL007", "Run audit", "EMP006", False),
    ("GOL016", "MIL008", "Map customer domain", "EMP009", True),
    ("GOL017", "MIL008", "Map finance domain", "EMP010", False),
    ("GOL018", "MIL009", "Backfill 5 years of history", None, False),
    ("GOL019", "MIL010", "Pilot 50 users", "EMP008", True),
    ("GOL020", "MIL011", "Decommission concentrators", "EMP008", True),
]

# id, project, user, date, hours, note  (dates ≤ 2026-10-13, within each project's range)
TIME_ENTRIES = [
    ("TIM001", "PRJ001", "EMP001", date(2026, 10, 5), 8, "Inventory export and clean-up"),
    ("TIM002", "PRJ001", "EMP001", date(2026, 10, 6), 7.5, "Owner tagging"),
    ("TIM003", "PRJ001", "EMP001", date(2026, 10, 7), 8, "Orphan review"),
    ("TIM004", "PRJ001", "EMP001", date(2026, 10, 8), 6, "Web tier migration prep"),
    ("TIM005", "PRJ001", "EMP002", date(2026, 10, 5), 8, "Network inventory"),
    ("TIM006", "PRJ001", "EMP002", date(2026, 10, 6), 8, "Tagging"),
    ("TIM007", "PRJ001", "EMP002", date(2026, 10, 9), 4, "App tier planning"),
    ("TIM008", "PRJ001", "EMP003", date(2026, 10, 7), 8, "Traffic monitoring setup"),
    ("TIM009", "PRJ001", "EMP003", date(2026, 10, 8), 8, "Power-down runbook"),
    ("TIM010", "PRJ002", "EMP005", date(2026, 9, 14), 8, "Design system spike"),
    ("TIM011", "PRJ002", "EMP005", date(2026, 9, 21), 8, "Buttons and inputs"),
    ("TIM012", "PRJ002", "EMP005", date(2026, 10, 12), 8, "Account overview page"),
    ("TIM013", "PRJ002", "EMP006", date(2026, 9, 15), 7, "Token mapping"),
    ("TIM014", "PRJ002", "EMP006", date(2026, 10, 1), 6, "Component review"),
    ("TIM015", "PRJ002", "EMP007", date(2026, 10, 12), 8, "Billing history API"),
    ("TIM016", "PRJ002", "EMP007", date(2026, 10, 13), 8, "Billing history UI"),
    ("TIM017", "PRJ003", "EMP009", date(2026, 10, 12), 8, "Customer domain mapping"),
    ("TIM018", "PRJ003", "EMP009", date(2026, 10, 13), 8, "Customer domain mapping"),
    ("TIM019", "PRJ003", "EMP010", date(2026, 10, 12), 6, "Finance domain discovery"),
    ("TIM020", "PRJ004", "EMP008", date(2026, 6, 2), 8, "Pilot setup"),
    ("TIM021", "PRJ004", "EMP008", date(2026, 7, 20), 8, "Cutover support"),
    ("TIM022", "PRJ004", "EMP007", date(2026, 8, 10), 8, "Concentrator decommission"),
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
    logger.info(
        "Demo data loaded: %d managers, %d employees, %d projects", len(MANAGERS), len(EMPLOYEES), len(PROJECTS)
    )


def ensure_demo_data(conn=None) -> bool:
    """Load the demo set if enabled and the database only has the bootstrap admin. Returns True if loaded."""
    if not get_settings().seed_demo_data:
        return False
    connection = conn or db.get_conn()
    if not is_needed(connection):
        return False
    load(connection)
    return True
