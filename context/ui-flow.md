# UI Flow

React 19 + Vite + Material UI + React Router. One layout (`AppShell`: top bar with user name/role,
left nav that varies by role, content area). Mobile: nav collapses into a drawer. Every page shows
loading skeleton, empty state, and an error `Alert`; every mutation shows a `Snackbar` on success/failure.

## Route map

| Path | Page | Roles | APIs |
|---|---|---|---|
| `/login` | LoginPage | public | `POST /auth/login` |
| `/` | DashboardPage | all | `GET /dashboard` (role-shaped) |
| `/projects` | ProjectsPage | all | `GET /projects?q=&status=&archived=&limit=&offset=` (archived toggle for admin); filters and `page` in the URL |
| (dialog on `/projects` and `/`) | ProjectDialog, create mode | admin | `GET /users?role=manager`, `POST /projects` |
| `/projects/:id` | ProjectDetailPage | viewers | `GET /projects/{id}`, `/stats`, `/members`, `/milestones`, `/time-entries` |
| `/milestones/:id` | MilestoneDetailPage | viewers | `GET /milestones/{id}`, goal endpoints |
| `/users` | UsersPage | admin, manager | `GET /users?q=&role=&available=&inactive=&limit=&offset=` (paged, `page` in the URL; admin subtitle from `summary`), `POST /users` (admin) |
| `/users/:id` | UserDetailPage | per rules | `GET /users/{id}`, `PATCH /users/{id}` |
| `/team` | TeamPage | manager, employee | `GET /users/{me}/team` |
| `/profile` | ProfilePage | all | `GET /auth/me`, `PATCH /users/{me}` |
| `/audit-log` | AuditLogPage | admin | `GET /audit-log` |
| `*` | NotFoundPage | — | — |

Unauthenticated → redirect to `/login`. Wrong role → `403` page. A `401` from any API clears the session and redirects to `/login`.

## Per-role landing (DashboardPage)
Slice 8 additions: manager **Due soon** table (open milestones overdue or due ≤ 7 days across their projects, with
assignees; rows link to the milestone), team column **Current milestone**, warning tag on `0 h` for anyone on a project;
admin **Recent activity** (last 8 audit rows, "View all" → `/audit-log`) and wider **Needs attention** reasons;
employee milestone line shows due date + `DueTag` + teammates, and a **Recent entries** table (last 5, edit in place).


- **Admin** (slice 12, D21): three pillar tiles — hours logged of capacity, budget consumed of planned (both over active projects, with bars), people available (links to `/users?available=true`); the **Project health** board: every non-archived project, worst first, with a health word (Late, At risk, Needs setup, Done not archived, On track) plus the specific reason tags, progress, budget left, next due and end date with cues; **Recent activity**. Quick links: Users, New project (dialog). People counts live on the Users page subtitle.
- **Manager**: cards per managed project (health word beside the status chip except for finished ones, hours completed / capacity bar, budget remaining, open milestones, next due), **Due soon**, team list showing each report's current project (or "available"), current milestone, hours this week, and the team total against 40 h per person on a project.
- **Employee**: "My current project" card (hours assigned vs logged, current milestone) or an "Available — not assigned to a project" state; "My open goals" with checkboxes; "Log time" button (disabled when available); "Past projects" list.

## Main flows

### F1 Login
LoginPage form (username, password) → `POST /auth/login` → store token + user → redirect `/`. Error: inline alert "Invalid username or password".

### F2 Admin creates a user
UsersPage → "New user" `FormDialog`: username, temp password, first/last name, email, job title, salary, role (select), manager (select, shown only when role = employee, options from `GET /users?role=manager`) → `POST /users` → row appended, snackbar. 409 → field error on username/email.

### F3 Admin creates a project
ProjectDialog (create mode, opened by "New project" on the Projects page or the admin dashboard — a dialog like every other "new …" action): name, description, budget, start/end (date pickers), manager (select) → `POST /projects` → navigate to detail. The same dialog edits a project from its page. Validation inline: end ≥ start, budget ≥ 0.

### F4 Manager staffs a project
ProjectDetailPage › **Members** tab → "Add member" dialog: employee select fed by `GET /projects/{id}/available-members` (only employees with no active project; the dialog also shows a collapsed "Unavailable" list with each busy report's current project so the manager knows who frees up when), hours assigned (number, max = capacity per member shown as helper text) → `POST /projects/{id}/members`. A `PROJECT_CONFLICT` (race) shows as a field error. Members table has an "Active / Released" chip and a "Show released" toggle. Row actions: edit hours (inline), remove (ConfirmDialog: "X will be released from this project and unassigned from its milestones/goals; their logged hours are kept").

### F5 Manager plans milestones
ProjectDetailPage › **Milestones** tab: ordered list with status chip, due date, goals done/total progress bar, assignees avatars. "New milestone" dialog: name, description, dates (bounded by project dates), assignees (multi-select fed by `GET /projects/{id}/available-assignees` — members already on an open milestone are listed disabled with the hint "on *<milestone name>*"). A `MILESTONE_CONFLICT` from the server is shown as a field error naming the blocked employees. Click → MilestoneDetailPage: edit header, goal list (add goal with optional assignee, inline rename, delete), "Mark complete" button (ConfirmDialog lists open goals if any and notes that assignees become free for the next milestone), "Reopen" (error toast if an assignee has moved on). Milestones tab also shows, per member, which open milestone they're currently on (or "available").

### F6 Employee works
When viewing a project they've been released from, the detail page shows an info banner "You were released from this project on <date>" and hides all actions (no goal toggles, no Log time); everything else is readable.
Dashboard "My open goals" → checkbox → `PATCH /goals/{id} {isDone}` (optimistic, revert on error). ProjectDetailPage for employees is read-mostly: Overview (dates, manager, my hours), Milestones (goals assigned to me are checkable), **Time** tab: "Log time" dialog (date default today, hours, note) → `POST /projects/{id}/time-entries`; list of own entries with edit/delete.

### F7 Manager monitors
ProjectDetailPage › **Overview** tab: StatCards — Capacity / Assigned / Completed hours, Budget / Consumed / Remaining; per-member table (hours assigned, completed, % of capacity, cost consumed); per-milestone progress. Edit project (dialog, same fields as F3 minus manager). "Mark project complete" enabled only when `milestoneCounts.open === 0`.

### F8 Admin archives / restores
ProjectsPage: admin sees "Show archived" toggle. Row/detail action "Archive" (ConfirmDialog: "members will be released and become available") → `POST /projects/{id}/archive`. Archived detail page shows an "Archived" banner, all write actions hidden, "Unarchive" for admin; a `PROJECT_CONFLICT` on unarchive shows which members are now elsewhere.

### F9 Admin reassigns an employee's manager / project's manager
UserDetailPage (admin view) → manager select → `PATCH /users/{id} {managerId}`. ProjectDetailPage overview (admin) → manager select → `PATCH /projects/{id} {managerId}`.

### F11 Admin reviews the audit log
AuditLogPage (admin nav item "Audit log"): `DataTable` newest-first with columns time, actor (name + role chip), action, entity (link to the project/user/milestone where applicable), summary. Filter bar: actor select, entity type, action, date range → query params. Row expand shows `details` JSON. Paging footer ("1–50 of 312", `page` in the URL, `offset` to the API). Managers/employees never see the nav item; direct navigation gets the 403 page.

### F10 Profile
ProfilePage: first/last name, email editable; username, role, title, manager read-only; salary shown to self (read-only).

## Forms & validation (client side mirrors server)
- Required markers, inline field errors, submit disabled while pending, server `VALIDATION_ERROR.details.field` mapped to the matching field.
- Dates via MUI `TextField type="date"` (no extra date-picker dependency in MVP).
- Numbers: hours step 0.25; money 2 decimals.

## Components (reusable, no fetching)
`AppShell`, `RoleGate`, `DataTable` (sortable columns, empty state), `StatCard`, `ProgressBar` (hours/capacity), `StatusChip` (project/milestone status, archived), `FormDialog`, `ConfirmDialog`, `UserSelect`, `ErrorAlert`, `PageHeader`.

### Labels and bars (D24)
Normal states (Active, Open, a person's role, a 200 result) are quiet dot-and-text labels; exceptions (Overdue,
At risk, Archived, Deactivated, Available, a failed request) are tinted tags, so one exception stands out in a
list of normal rows. Roles keep a coloured dot (indigo admin, ink manager, grey employee). Progress inside a table
row is one line: bar, percentage, raw figures. Health on the admin board and manager cards is the one-word tag
with the reasons as a muted line beneath. Section summaries sit under the section title; the right side holds actions.

### Paged lists (D23)
Users, Projects, the project Time tab and the Audit log read one page at a time (25 rows; 50 on the audit
log). `DataTable` shows the "26–50 of 112" footer with previous/next whenever the list has rows (arrows disabled on a single page).
The page number sits in the URL beside the filters, so a link to page 2 of the available employees works;
typing in the search box waits 300 ms and then returns to page 1. The Time tab keeps its page in memory
(it is a tab inside the project page) and its hours tile says "Hours on this page" when the list is longer
than a page.
