# Data Model

PostgreSQL. All tables have `created_at`/`updated_at TIMESTAMPTZ`. Primary keys are `TEXT`
holding the 6-character public ID (D6). Money is `NUMERIC(12,2)`; hours are `NUMERIC(7,2)`.

## Entity diagram

```
users ──< project_members >── projects ──< milestones ──< goals
  │ manager_id (self)              │           │
  │                                │           └──< milestone_assignees >── users
  └──< time_entries >──────────────┘
```

## users

| Column | Type | Rules |
|---|---|---|
| id | TEXT PK | 6 chars `[A-Z0-9]`, generated server-side, retried on collision. |
| username | TEXT UNIQUE NOT NULL | 3–32 chars, `[a-z0-9._-]`, lowercase. Immutable after creation. |
| password_hash | TEXT NOT NULL | bcrypt. Never returned by any endpoint. |
| first_name, last_name | TEXT NOT NULL | 1–60 chars, trimmed. |
| email | TEXT UNIQUE NOT NULL | RFC-ish regex, lowercase. |
| job_title | TEXT NOT NULL | 1–80 chars. |
| salary | NUMERIC(12,2) NOT NULL | ≥ 0. Annual. Visible only to admins and the user's own manager; used server-side for cost math. |
| role | TEXT NOT NULL | `admin` \| `manager` \| `employee`. |
| manager_id | TEXT FK users(id) NULL | **Required when role = employee**, must reference a user with role `manager`. Must be NULL otherwise. |
| is_active | BOOLEAN DEFAULT true | Soft delete / deactivation (admin only). Inactive users cannot log in. |

Ownership: created by admin; `role`, `manager_id`, `salary`, `job_title`, `is_active` editable by
admin only; `first_name`, `last_name`, `email` editable by admin, the user's manager, or the user.

## projects

| Column | Type | Rules |
|---|---|---|
| id | TEXT PK | 6-char ID. |
| name | TEXT NOT NULL | 1–120 chars, unique among non-archived projects (enforced in service). |
| description | TEXT | ≤ 2000 chars. |
| budget | NUMERIC(12,2) NOT NULL | ≥ 0. |
| start_date, end_date | DATE NOT NULL | `end_date >= start_date`. |
| manager_id | TEXT FK users(id) NOT NULL | Must be role `manager`. Changed by admin only. |
| status | TEXT NOT NULL | `active` \| `complete`. `complete` only settable by manager/admin and only when all milestones are complete. |
| archived | BOOLEAN DEFAULT false | Admin only. Archived projects are hidden from non-admins and read-only for everyone. |

Derived (computed in service, never stored):
- `working_days` = weekdays between start and end inclusive; `capacity_hours_per_member = working_days / 5 × 40`.
- `capacity_hours = capacity_hours_per_member × member_count` (members with `is_active`, or all members once the project is complete).
- `hours_assigned = Σ project_members.hours_assigned`; `hours_completed = Σ time_entries.hours`.
- `cost_consumed = Σ over members (member hours_completed × member.salary / 2080)`.
- `budget_remaining = budget − cost_consumed`.

Ownership: created by admin; info/budget/dates editable by admin or the project's manager.

## project_members

| Column | Type | Rules |
|---|---|---|
| project_id | TEXT FK projects | PK part. |
| user_id | TEXT FK users | PK part. Must be role `employee` (the manager is implied by `projects.manager_id`, not a member row). |
| hours_assigned | NUMERIC(7,2) DEFAULT 0 | 0 ≤ x ≤ `capacity_hours_per_member`. |
| is_active | BOOLEAN NOT NULL DEFAULT true | `true` while the project is `active` and not archived and the member hasn't been removed. Maintained by the service. |
| added_at | TIMESTAMPTZ | |
| released_at | TIMESTAMPTZ NULL | Set when `is_active` flips to false (project completed/archived or member removed). |
| released_reason | TEXT NULL | `removed` \| `completed` \| `archived`. Lets un-archive re-claim exactly the people archiving released; `completed` members still count towards capacity. |

**Invariant (M8, D15): one active project per employee.**
```sql
CREATE UNIQUE INDEX one_active_project_per_employee
  ON project_members (user_id) WHERE is_active;
```
Enforced in `projects/service.py` (check + row lock before insert → `409 PROJECT_CONFLICT`) with the
partial unique index as the backstop. State transitions, all in one transaction:
- **Add member**: fails if the user has any `is_active` membership elsewhere.
- **Remove member**: sets `is_active = false, released_at = now()` (row kept for history); deletes the user's `milestone_assignees` rows for that project's milestones and unassigns their goals. Time entries are **kept**.
- **Project complete / archive**: all its members → `is_active = false`.
- **Project unarchive**: if the project is `complete` nothing changes (members stay released). If it is `active`, members are re-activated; any member who has since joined another active project causes `409 PROJECT_CONFLICT` listing them — the admin removes those members first.
- A released member may be re-added later (same PK) → service re-activates the row instead of inserting.

## milestones

| Column | Type | Rules |
|---|---|---|
| id | TEXT PK | 6-char ID. |
| project_id | TEXT FK projects NOT NULL | |
| name | TEXT NOT NULL | 1–120 chars. |
| description | TEXT | ≤ 2000. |
| start_date, due_date | DATE NOT NULL | Within the project's date range; `due_date >= start_date`. |
| status | TEXT NOT NULL | `open` \| `complete`. Set by project manager/admin. |
| completed_at | TIMESTAMPTZ NULL | |
| sort_order | INTEGER | For display. |

Ownership: project manager or admin create/edit/complete. Cannot be modified when the project is archived.

## milestone_assignees

| Column | Rules |
|---|---|
| project_id FK | Denormalised from the milestone (for the uniqueness index). |
| is_open BOOLEAN | Mirrors the milestone's status; maintained by the service. |
| milestone_id FK, user_id FK | PK. `user_id` must be a `project_members` row of the milestone's project. |

**Invariant (M13a, D14):** for a given `(project, user)` there is at most one row whose milestone
has `status = 'open'`. Enforced in `milestones/service.py` inside the assignment transaction
(`SELECT … FOR UPDATE` on the user's open-milestone rows in that project), and as a
defence-in-depth partial unique index:

```sql
-- milestone_assignees carries a denormalised copy of project_id and is_open, kept in sync by the service
CREATE UNIQUE INDEX one_open_milestone_per_user_per_project
  ON milestone_assignees (project_id, user_id) WHERE is_open;
```
Completing a milestone sets `is_open = false` on its assignee rows; reopening sets it back to
true and therefore fails (409) if the user has moved on to another open milestone.

## goals

| Column | Type | Rules |
|---|---|---|
| id | TEXT PK | |
| milestone_id | TEXT FK NOT NULL | |
| title | TEXT NOT NULL | 1–200. |
| assignee_id | TEXT FK users NULL | Must be a `milestone_assignees` member of this milestone. |
| is_done | BOOLEAN DEFAULT false | Toggled by the assignee, the project manager, or admin. |
| done_at | TIMESTAMPTZ NULL | |
| rag_status | TEXT NULL | Stretch (S1): `red` \| `amber` \| `green`. Column reserved, not exposed in MVP. |

## time_entries

| Column | Type | Rules |
|---|---|---|
| id | TEXT PK | |
| project_id FK, user_id FK | NOT NULL | User must be a member of the project at the time of logging. |
| entry_date | DATE NOT NULL | Within project dates; not in the future. |
| hours | NUMERIC(5,2) NOT NULL | 0.25 ≤ hours ≤ 24; Σ per user per day ≤ 24. |
| note | TEXT | ≤ 500. |

Ownership: created by the employee for themselves; editable/deletable by the author within the same project while the project is active; manager/admin may delete. Blocked when the project is archived.

## audit_log

Append-only. Written by the router after every successful mutating request and every login
attempt (D13). Never updated or deleted by application code.

| Column | Type | Rules |
|---|---|---|
| id | BIGSERIAL PK | Internal only (not a 6-char ID — high volume, never user-facing). |
| occurred_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| actor_id | TEXT FK users NULL | NULL for failed logins (unknown user). |
| actor_role | TEXT NULL | Snapshot of role at the time (roles can change later). |
| action | TEXT NOT NULL | Dotted verb from the route table, e.g. `auth.login`, `auth.login_failed`, `user.create`, `user.update`, `project.create`, `project.update`, `project.archive`, `project.unarchive`, `project.complete`, `project.member_add`, `project.member_update`, `project.member_remove`, `milestone.create`, `milestone.update`, `milestone.complete`, `milestone.reopen`, `goal.create`, `goal.update`, `goal.delete`, `time_entry.create`, `time_entry.update`, `time_entry.delete`. |
| entity_type | TEXT NULL | `user` \| `project` \| `milestone` \| `goal` \| `time_entry`. |
| entity_id | TEXT NULL | The 6-char ID of the primary entity (from the path, or from the created object's `id`). |
| project_id | TEXT NULL | Denormalised for filtering; derived from the entity when applicable. |
| summary | TEXT NOT NULL | Human-readable one-liner, e.g. `Archived project "Legacy VPN Retirement"`. |
| details | JSONB NULL | Sanitised request body (passwords/tokens removed; salary redacted to `"[redacted]"`). |
| status_code | SMALLINT NOT NULL | HTTP status of the response. |

Indexes: `(occurred_at DESC)`, `(actor_id, occurred_at DESC)`, `(entity_type, entity_id)`.

Ownership: read by admin only. No write path other than the router hook.

## Seed data (M16)

- 1 admin (`admin` / password printed in README, forced-change is out of scope).
- 2 managers, 6 employees (3 per manager), realistic titles/salaries.
- Project "Decommission 1,000 Servers" (manager 1): milestones "Inventory & tagging", "Migrate workloads batch 1", "Power-down batch 1", "Migrate workloads batch 2", each with 2–4 goals, 3 of manager 1's employees as members with hours assigned, a dozen time entries.
- Project "Customer Portal Redesign" (manager 2): 3 milestones, 2 of manager 2's employees.
- 1 finished project "Legacy VPN Retirement" (status complete, not yet archived, manager 2) with released memberships for 2 employees (one of whom is now on "Customer Portal Redesign" — demonstrates history + availability).
- At least one employee per manager left **available** (no active project) so adding members can be demoed.

Seed runs only when `users` is empty.
