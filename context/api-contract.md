# API Contract

Base path: `/api/v1` (CloudFront in AWS, proxy `http://localhost:3001` locally). All bodies are
JSON. All endpoints except `POST /auth/login` require `Authorization: Bearer <jwt>`.

## Conventions

- IDs are 6-char strings. Dates are `YYYY-MM-DD`. Timestamps are ISO-8601 UTC. Money and hours are JSON numbers.
- Success: `200` with object/array, `201` with the created object, `204` with no body.
- Error envelope (every non-2xx):
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "end_date must be on or after start_date", "details": { "field": "end_date" } } }
  ```
  Codes: `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `PROJECT_CONFLICT` 409 (employee already on an active project; `details.userIds`, `details.projectId`) · `MILESTONE_CONFLICT` 409 (employee already on an open milestone in this project) · `MILESTONE_BLOCKED` 409 (the milestone waits on one that is still open; `details.blockedBy`) · `INTERNAL` 500.
- Lists return `{ "items": [...], "total": n }`. Filtering via query params where listed. Users, projects, time entries and the audit log page (`Page<T>` below); milestones and members are returned whole.
- `UserSummary` = `{id, firstName, lastName, email, jobTitle, role}` (no salary). `UserFull` = UserSummary + `salary, managerId, isActive, username`. Salary is included only when the actor is admin or the user's manager.
- Field names are camelCase on the wire; snake_case in the database. Handlers do the mapping via DTOs.

Paged lists (users, projects, time entries, audit log) share one shape:
```
Page<T> {items: T[], total, limit, offset}   — limit defaults to 25 (audit log 50), max 100 (audit log 200);
                                               0 means the default; anything else out of range → 400 naming the field
```
Milestones, goals and members are returned whole: they are bounded by one project.

## Auth

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| POST | `/auth/login` | `{username, password}` | `200 {token, expiresAt, user: UserFull(self)}` · `401` bad credentials or inactive | public |
| GET | `/auth/me` | — | `200 UserFull(self)` | any |
| POST | `/auth/change-password` | `{currentPassword, newPassword}` | `200 {changed: true}` · `400` wrong current password (`details.field = currentPassword`), new password < 8 chars or same as current | any (self) |

## Users

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/users?role=&managerId=&q=&available=&inactive=&limit=25&offset=0` | — | `200 Page<UserFull> & {summary: {admins, managers, employees, available}\|null}` (`q` searches name/email/username; `available=true` = employees on no project; deactivated people only with `inactive=true`; `summary` counts every active person, admins only) | admin: all. manager: own reports (+self), filtered and paged the same way. employee: `403`. |
| POST | `/users` | `{username, password, firstName, lastName, email, jobTitle, salary, role, managerId?}` | `201 UserFull` · `400` · `409` username/email taken | admin |
| POST | `/users/import` | `{csv, dryRun?}` — the text of one CSV (≤ 1 MB, ≤ 500 rows; header `username, firstName, lastName, email, jobTitle, salary, role, manager, password` in any order; `manager` = manager's username, existing or earlier in the file; blank password generated) | `200 ImportReport` (dry run: nothing written, no audit; otherwise all rows created in one transaction, managers first) · `400 VALIDATION_ERROR` with `details = ImportReport` when any row is invalid (nobody created) or a message for a whole-file problem | admin |
| GET | `/users/{id}` | — | `200 UserFull & {manager: {id, firstName, lastName}\|null, projects: MembershipHistory[]}` (salary only for admin / own manager / self; archived projects only for admins) · `403` not allowed to view · `404` | admin; manager for self + reports; employee for self, teammates (same manager) and own manager |
| PATCH | `/users/{id}` | any of `{firstName, lastName, email}`; admin additionally `{jobTitle, salary, role, managerId, isActive}` | `200 UserFull` | admin; manager (name/email of reports); employee (name/email of self) | `password` (≥ 8 chars) is admin-only and sets a new temporary password (hash stored, never returned).
| GET | `/users/{id}/team` | — | `200 {manager: UserSummary, members: UserSummary[]}` | admin; the manager (`id` = self); employee (`id` = self → their manager's team) |

```
ImportReport {rows: [{line, username|null, status: "ok"|"error", errors: string[], generatedPassword?, id?}],
              summary: {total, valid, invalid, created}}     (D26; `generatedPassword` only on a valid row with a blank password, shown once)
MembershipHistory {id, name, status, archived, hoursAssigned, hoursCompleted, isActive, releasedReason|null,   (hours only by design: this is the person's effort, not the project's completion)
                   addedAt, releasedAt|null}     (one per project the user has ever been on; active first, then newest)
```
Rules enforced server-side: `managerId` required iff `role=employee`; `managerId` must be a `manager`; changing `role` away from `manager` fails with `409` if they still manage projects or users.

## Projects

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/projects?archived=false&status=&q=&limit=25&offset=0` | — | `200 Page<ProjectSummary>` (`q` searches the project and manager name) | admin: all (archived only via `archived=true`). manager: projects they manage. employee: projects they are or were a member of (non-archived). |
| POST | `/projects` | `{name, description?, budget, startDate, endDate, managerId}` | `201 ProjectDetail` | admin |
| GET | `/projects/{id}` | — | `200 ProjectDetail` · `404` (also for archived to non-admins) | admin; its manager; its members |
| PATCH | `/projects/{id}` | `{name?, description?, budget?, startDate?, endDate?}`; admin additionally `{managerId}` | `200 ProjectDetail` · `409` if archived | admin; its manager |
| POST | `/projects/{id}/complete` | — | `200 ProjectDetail` · `409` if open milestones remain | admin; its manager |
| POST | `/projects/{id}/archive` | — | `200 ProjectDetail` (releases all members) | admin |
| POST | `/projects/{id}/unarchive` | — | `200 ProjectDetail` · `409 PROJECT_CONFLICT` if re-activating members collides (see data-model) | admin |
| GET | `/projects/{id}/members?includeReleased=false` | — | `200 {items: Member[]}` | admin; its manager; its members |
| GET | `/projects/{id}/available-members` | — | `200 {items: UserSummary[]}` — employees with no active project (manager: own reports only; admin: all) | admin; its manager |
| POST | `/projects/{id}/members` | `{userId, hoursAssigned?}` | `201 Member` · `409 PROJECT_CONFLICT` on another active project · `409 CONFLICT` already active member / not employee | admin; its manager |
| PATCH | `/projects/{id}/members/{userId}` | `{hoursAssigned}` | `200 Member` | admin; its manager |
| DELETE | `/projects/{id}/members/{userId}` | — | `204` — releases the member (row kept, `isActive=false`), cascades per data-model | admin; its manager |
| GET | `/projects/{id}/stats` | — | `200 ProjectStats` | admin; its manager; its members (cost fields omitted for employees) |

Shapes:
```
ProjectSummary  {id, name, status, archived, startDate, endDate, manager: UserSummary, memberCount,
                 hoursAssigned, hoursCompleted, capacityHours, capacityHoursPerMember,
                 completedGoals, totalGoals, progressPercent|null}   (D27: goals across all milestones;
                 progressPercent is null when totalGoals = 0 — "not configured", not 0 %)
ProjectDetail   ProjectSummary + {description, milestoneCounts:{open, complete},
                 myMembership: {isActive, hoursAssigned, hoursCompleted, releasedAt, releasedReason} | null,
                 budget, costConsumed, budgetRemaining}
                 (budget/cost fields present only for admin and the manager)
Member          {user: UserSummary, hoursAssigned, hoursCompleted, capacityHours, costConsumed?, isActive, addedAt,
                 releasedAt, releasedReason, currentMilestone: {id, name}|null}   (their open milestone on this project)
GET /projects/{id}: 403 for a non-member/non-manager; 404 for an archived project unless admin.
hoursAssigned is capped at capacityHoursPerMember (400 VALIDATION_ERROR otherwise).
UserSummary gains `currentProject: {id, name} | null` when listed via /users or /users/{id}/team (admin/manager views).
ProjectStats    {capacityHours, hoursAssigned, hoursCompleted, budget?, costConsumed?, budgetRemaining?,
                 perMember: Member[], milestoneCounts, completedGoals, totalGoals, progressPercent|null}
```

## Milestones & goals

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/projects/{id}/milestones?limit=25&offset=0` | — | `200 Page<Milestone> & {nextDueId: string\|null}` in reading order: open by due date, then completed by completion date (D28) | project viewers |
| | *Dependencies (D29)* | `POST`/`PATCH` milestone bodies accept `blockedById: string\|null` (same project, not itself, no loop → `400`) | `Milestone` carries `blockedBy: {id, name, status}\|null` and `blocked` (true while the blocker is open); `POST /milestones/{id}/complete` → `409 MILESTONE_BLOCKED` with `details.blockedBy` while blocked | |
| POST | `/projects/{id}/milestones` | `{name, description?, startDate, dueDate, assigneeIds?: []}` | `201 Milestone` · `409 MILESTONE_CONFLICT` if any assignee is already on an open milestone in this project (`details.userIds`, `details.milestoneId`) | admin; project manager |
| GET | `/milestones/{id}` | — | `200 Milestone (with goals, assignees)` | project viewers |
| PATCH | `/milestones/{id}` | `{name?, description?, startDate?, dueDate?, assigneeIds?}` | `200 Milestone` · `409 MILESTONE_CONFLICT` as above (only for *newly added* assignees) | admin; project manager |
| POST | `/milestones/{id}/complete` | — | `200 Milestone` (`details.openGoals` returned as warning info, not blocking). Frees its assignees for other milestones. | admin; project manager |
| POST | `/milestones/{id}/reopen` | — | `200 Milestone` · `409` if project complete · `409 MILESTONE_CONFLICT` if an assignee has since joined another open milestone | admin; project manager |
| GET | `/projects/{id}/available-assignees?milestoneId=` | — | `200 {items: UserSummary[], busy: [{user: UserSummary, milestone: {id, name}}]}` — `items`: active members with no open milestone in this project (plus current assignees of `milestoneId` if given); `busy`: the rest, with the open milestone holding them (for the disabled options in ui-flow F5) | admin; project manager |
| POST | `/milestones/{id}/goals` | `{title, assigneeId?}` | `201 Goal` · `400` if `assigneeId` is not one of the milestone's assignees · `409` if the milestone is complete | admin; project manager |
| PATCH | `/goals/{id}` | `{title?, assigneeId?, isDone?}` | `200 Goal` · `409` if the milestone is complete (reopen it first) | title/assignee: admin, project manager. `isDone`: additionally the goal's assignee. |
| DELETE | `/goals/{id}` | — | `204` | admin; project manager |

```
Milestone {id, projectId, name, description, startDate, dueDate, status, completedAt, assignees: UserSummary[],
           goals: Goal[], goalsDone, goalsTotal}
Goal      {id, milestoneId, title, assignee: UserSummary|null, isDone, doneAt}
```
All writes `409` when the project is archived or complete. `MILESTONE_CONFLICT.details` also carries `conflicts: [{userId, milestoneId, milestoneName}]` so the UI can name who is busy where.

## Time entries

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/projects/{id}/time-entries?userId=&from=&to=&limit=25&offset=0` | — | `200 Page<TimeEntry>}` | admin; project manager; member (own only — `userId` forced to self) |
| POST | `/projects/{id}/time-entries` | `{entryDate, hours, note?}` | `201 TimeEntry` · `403` not an *active* member · `400` limits (hours 0.25–24, date within project dates and not in the future) · `409` project archived/complete | active member (self) |
| PATCH | `/time-entries/{id}` | `{entryDate?, hours?, note?}` | `200 TimeEntry` | author |
| DELETE | `/time-entries/{id}` | — | `204` | author; project manager; admin |

```
TimeEntry {id, projectId, user: UserSummary, entryDate, hours, note, createdAt}
```

## Dashboard

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/dashboard` | — | `200` role-shaped payload (below) | any |

```
Admin    {role:"admin", projects: [ProjectCard & {reasons: Reason[], health: Health}]   (every non-archived project,
          worst health first, then name), summary: {projects: {late, atRisk, needsSetup, toClose, onTrack},
          hoursCompleted, capacityHours, budget, costConsumed}   (sums over ACTIVE non-archived projects only),
          people: {employees, onProject, available}, recentActivity: AuditEntry[]}   (≤ 8, newest first)
Manager  {role:"manager", projects: [ProjectCard & {reasons: Reason[], health: Health}],
          dueSoon: [{id, name, dueDate, project:{id,name}, assignees: UserSummary[]}],
          team: [{user: UserSummary, currentProject|null, currentMilestone:{id,name}|null, hoursThisWeek}],
          week:{start, end}}
Employee {role:"employee", currentProject: (ProjectCard & {myHoursAssigned, myHoursCompleted,
          currentMilestone:{id, name, dueDate, assignees: UserSummary[]}|null}) | null,
          pastProjects: ProjectCard[], openGoals: [{id, title, milestone:{id,name,dueDate}, project:{id,name}}],
          recentEntries: TimeEntry[], hoursThisWeek, week:{start, end}}   (recentEntries: ≤ 5 own, newest first)
ProjectCard {id, name, status, archived, startDate, endDate, memberCount, hoursAssigned, hoursCompleted,
          capacityHours, milestoneCounts, completedGoals, totalGoals, progressPercent|null, nextDueDate|null,
          manager:{id, firstName, lastName},
          budget?, costConsumed?, budgetRemaining?}
          (costs: admin/manager only; nextDueDate = earliest due date among open milestones)
Reason   "over_budget" | "past_end" | "overdue_milestone" | "no_members" | "no_milestones"
          (the last four only for active projects)
Health   "late" | "at_risk" | "needs_setup" | "to_close" | "on_track"   (D21; precedence in that order:
          late = active & past_end; at_risk = active & (overdue_milestone | over_budget); needs_setup = active &
          (no_members | no_milestones); to_close = complete & not archived; archived projects are never classified)
```
One read per landing page (ui-flow.md › Per-role landing); "this week" is Monday–Sunday of today.
`dueSoon` = open milestones on the manager's active, non-archived projects with dueDate ≤ today + 7 days
(overdue ones included), soonest first.

## Audit log (admin only)

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/audit-log?actorId=&entityType=&entityId=&projectId=&action=&from=&to=&limit=50&offset=0` | — | `200 {items: AuditEntry[], total, limit, offset}` · `400` bad limit/offset · `403` for non-admins | admin |
| GET | `/audit-log/actions` | — | `200 {items: string[]}` every action name the router can record, sorted · `403` for non-admins | admin |

```
AuditEntry {id, occurredAt, actor: UserSummary|null, actorRole, action, entityType, entityId, projectId,
            summary, details, statusCode}
```
Paged like the other lists but with its own sizes (`limit` ≤ 200, default 50, newest first).
There are no write endpoints; entries are produced automatically (D13).

## Health

| GET | `/health` | `200 {status:"ok", db:"ok"}` | public | — used by `start-dev.sh`'s reachability check and smoke tests.

## Measures (D27)
| Measure | Definition | Where |
|---|---|---|
| Project progress | `completedGoals / totalGoals` across the project's milestones; null when no goals | project list, detail, stats, every dashboard card |
| Milestone progress | `goalsDone / goalsTotal` within the milestone | milestone rows and page |
| Capacity used | `hoursCompleted / capacityHours` (logged hours over working days × 8 h × members) | project tiles, lists |
| Assigned hours used | member `hoursCompleted / hoursAssigned` | members, history, employee tile |
| Cost consumed | Σ logged hours × salary / 2,080; budget remaining = budget − cost | project and dashboard |
| Weekly workload | hours logged this week against 40 h | employee tile, manager team |
`hoursCompleted` keeps its name on the wire for compatibility; it is the sum of logged time, never completion.
