# Requirements — Project Tracking System

Source: workshop notes (Oct 2026) + `docs/full-stack.md` grading rubric. This file is the
authoritative reading of the requirements. If the code and this file disagree, this file wins
until it is deliberately changed.

## Problem statement

A system where an admin creates projects, managers staff them and break them into milestones,
and employees see the work assigned to them and log time against it. Tracks the three pillars
of resource management: **time** (hours), **cost** (budget), **resources** (people).

## Roles (exactly three)

| Role | Can | Cannot |
|---|---|---|
| **Admin** | Everything. Create/edit/archive/unarchive projects, create users of any role (incl. other admins), reassign an employee to a different manager, change any project's manager, view archives. | — |
| **Manager** | Edit info/budget of projects they manage; add/remove members of those projects; create/edit/complete milestones and goals; mark a project complete; edit **name and email only** of users in their immediate team. | Create projects. Create users. See archived projects. Touch projects they don't manage. Reassign an employee's manager. |
| **Employee** | View their current project and past projects they were on, their milestones/goals, their immediate team (same manager) and their manager. Check off goals assigned to them. Log time on their current project. Edit **own name and email only**. | Everything else. |

## Must-have (MVP)

### Users
- M1. Fields: 6-character random alphanumeric ID (shown to users), first name, last name, username, password (hashed), email, job title, salary, role, manager.
- M2. Every employee has exactly one manager. Only an admin changes it. Managers and admins have no manager.
- M3. Admin creates all users and sets a temporary password. Managers edit name/email of their direct reports. Employees edit own name/email and can see (not edit) their own salary.
- M4. Login with username + password; every API call after login is authenticated.

### Projects
- M5. Fields: name, description, budget (currency), start date, end date, manager, status, archived flag.
- M6. Only admins create projects. A project must always have a manager (set at creation, changeable by admin). A manager may manage several projects.
- M7. Managers edit name/description/budget/dates of their own projects.
- M8. **One active project per employee.** An employee is a member of at most one project that is `active` and not archived. They become available again when that project is completed or archived, or when they're removed from it. Past memberships are kept for history (hours, cost, visibility). Managers add/remove members on their projects, choosing only from available employees among **their own direct reports**; admins may add any available employee. (Changed 2026-10-14 — supersedes "employees can be on many projects"; D15.)
- M9. Start/end dates determine capacity: **working weeks × 40 h** per member. The UI shows hours assigned vs hours completed vs capacity per project and per member.
- M10. Per-member budget consumption is shown: `hours_completed × (salary / 2080)`.
- M11. **No hard deletes.** "Delete" = archive. Archived projects are visible only to admins; admins can unarchive.
- M12. A project becomes *complete* when the manager marks it so; the UI prevents this until all milestones are complete. A completed project can be archived.

### Milestones & goals
- M13. A project has many milestones. Each has name, description, start date, due date, status (open/complete), many assigned employees (from the project's members).
- M13a. **One open milestone per employee per project.** Within their project an employee can be assigned to only one milestone whose status is `open`. When that milestone is completed they become available for the next. (Clarified 2026-10-14, D14.)
- M14. A milestone has many goals (sub-tasks). Employees check goals off; managers mark the milestone complete (UI warns if goals remain open).
- M15. Removing an employee from a project removes them from all its milestones; removing them from a milestone unassigns their goals.
- M16. Seed data with example projects and milestones (e.g. "Decommission 1,000 servers" with phased milestones).

### Time
- M17. Employees log time entries (hours, date, note) against a project they're on. Hours completed = sum of entries.
- M18. Managers set `hours_assigned` per member per project.

### Audit log
- M19. **Every action** by any role (admin, manager, employee) is recorded: who, when, what action, on which entity, with a summary of the change. This covers logins and every create/update/archive/complete/assign/log-time operation. **Only admins can view the log.** Entries are never edited or deleted.

### Non-functional (from the rubric — these are graded)
- N1. Runs locally (LocalStack) and on AWS using the repo's scripts, with no manual steps beyond the documented ones.
- N2. JWT authentication, bcrypt password hashing, role checks enforced **server-side** on every endpoint; UI hides actions the role can't perform.
- N3. RESTful JSON API, consistent error envelope, correct status codes (200/201/204/400/401/403/404/409/500).
- N4. Backend organised by feature/domain (not one giant file); frontend by page/component/service.
- N5. Tests: backend unit + integration (pytest), frontend component tests, documented commands. Target 80 %.
- N6. Responsive UI (desktop + mobile) with loading, empty, error and success states.
- N7. README documents architecture, setup, trade-offs, test commands, known gaps.
- N8. CI must pass: Bandit on `backend/`, ESLint on `frontend/`.

## Nice-to-have (only after MVP is deployed and tested)
- S1. Red/Amber/Green status on goals/milestones (explicitly "stretch, not MVP").
- S2. Budget burn chart per project.
- S3. Search/filter on project and user lists.
- S4. Token refresh (MVP: 8-hour token, re-login on expiry).
- S5. Admin-triggered password reset.
- S6. Audit log filtering by actor/entity/date range and CSV export (the log itself is M19).

## Constraints
- C1. Stack: Python 3.13 on AWS Lambda, React (Vite) with Material UI, PostgreSQL (Aurora Serverless v2 in AWS, local Postgres in dev). Decided in `decisions.md` D1.
- C2. Must use the boilerplate's deployment model: each folder under `backend/` with `requirements.txt` becomes one Lambda, routed at `/api/{folder}`.
- C3. Lambda memory is 128 MB, timeout 300 s, Function URL auth = NONE (auth is our responsibility).
- C4. No migration tooling exists; schema creation is our code.
- C5. Three working days. Scope must fit; see `current-task.md` for the plan.
- C6. Infra edits allowed only where unavoidable and recorded in `decisions.md`.

## Out of scope
- Integrations (HR directory, SSO, email, calendar).
- Multi-tenancy, multiple organisations.
- Salary editing by anyone other than admin; payroll logic.
- Real-time updates (polling/refresh is fine).
- PWA/offline, i18n, dark mode.
- MongoDB/DocumentDB.
