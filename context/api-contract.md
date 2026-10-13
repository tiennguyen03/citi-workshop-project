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
  Codes: `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `PROJECT_CONFLICT` 409 (employee already on an active project; `details.userIds`, `details.projectId`) · `MILESTONE_CONFLICT` 409 (employee already on an open milestone in this project) · `INTERNAL` 500.
- Lists return `{ "items": [...], "total": n }`. Filtering via query params where listed. No pagination in MVP (data is small); `limit`/`offset` reserved.
- `UserSummary` = `{id, firstName, lastName, email, jobTitle, role}` (no salary). `UserFull` = UserSummary + `salary, managerId, isActive, username`. Salary is included only when the actor is admin or the user's manager.
- Field names are camelCase on the wire; snake_case in the database. Handlers do the mapping via DTOs.

## Auth

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| POST | `/auth/login` | `{username, password}` | `200 {token, expiresAt, user: UserFull(self)}` · `401` bad credentials or inactive | public |
| GET | `/auth/me` | — | `200 UserFull(self)` | any |

## Users

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/users?role=&managerId=` | — | `200 {items: UserFull[]}` | admin: all. manager: own reports (+self). employee: `403`. |
| POST | `/users` | `{username, password, firstName, lastName, email, jobTitle, salary, role, managerId?}` | `201 UserFull` · `400` · `409` username/email taken | admin |
| GET | `/users/{id}` | — | `200 UserFull` (salary only for admin / own manager / self) · `403` not allowed to view · `404` | admin; manager for self + reports; employee for self, teammates (same manager) and own manager |
| PATCH | `/users/{id}` | any of `{firstName, lastName, email}`; admin additionally `{jobTitle, salary, role, managerId, isActive}` | `200 UserFull` | admin; manager (name/email of reports); employee (name/email of self) |
| GET | `/users/{id}/team` | — | `200 {manager: UserSummary, members: UserSummary[]}` | admin; the manager (`id` = self); employee (`id` = self → their manager's team) |

Rules enforced server-side: `managerId` required iff `role=employee`; `managerId` must be a `manager`; changing `role` away from `manager` fails with `409` if they still manage projects or users.

## Projects

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/projects?archived=false&status=` | — | `200 {items: ProjectSummary[]}` | admin: all (archived only via `archived=true`). manager: projects they manage. employee: projects they are or were a member of (non-archived). |
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
                 hoursAssigned, hoursCompleted, capacityHours}
ProjectDetail   ProjectSummary + {description, budget, costConsumed, budgetRemaining, milestoneCounts:{open, complete}}
                 (budget/cost fields present only for admin and the manager)
Member          {user: UserSummary, hoursAssigned, hoursCompleted, capacityHours, costConsumed?, isActive, addedAt, releasedAt}
UserSummary gains `currentProject: {id, name} | null` when listed via /users or /users/{id}/team (admin/manager views).
ProjectStats    {capacityHours, hoursAssigned, hoursCompleted, budget?, costConsumed?, budgetRemaining?,
                 perMember: Member[], perMilestone: [{milestoneId, name, status, goalsDone, goalsTotal}]}
```

## Milestones & goals

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/projects/{id}/milestones` | — | `200 {items: Milestone[]}` | project viewers |
| POST | `/projects/{id}/milestones` | `{name, description?, startDate, dueDate, assigneeIds?: []}` | `201 Milestone` · `409 MILESTONE_CONFLICT` if any assignee is already on an open milestone in this project (`details.userIds`, `details.milestoneId`) | admin; project manager |
| GET | `/milestones/{id}` | — | `200 Milestone (with goals, assignees)` | project viewers |
| PATCH | `/milestones/{id}` | `{name?, description?, startDate?, dueDate?, assigneeIds?}` | `200 Milestone` · `409 MILESTONE_CONFLICT` as above (only for *newly added* assignees) | admin; project manager |
| POST | `/milestones/{id}/complete` | — | `200 Milestone` (`details.openGoals` returned as warning info, not blocking). Frees its assignees for other milestones. | admin; project manager |
| POST | `/milestones/{id}/reopen` | — | `200 Milestone` · `409` if project complete · `409 MILESTONE_CONFLICT` if an assignee has since joined another open milestone | admin; project manager |
| GET | `/projects/{id}/available-assignees?milestoneId=` | — | `200 {items: UserSummary[]}` — members with no open milestone in this project (plus current assignees of `milestoneId` if given) | admin; project manager |
| POST | `/milestones/{id}/goals` | `{title, assigneeId?}` | `201 Goal` | admin; project manager |
| PATCH | `/goals/{id}` | `{title?, assigneeId?, isDone?}` | `200 Goal` | title/assignee: admin, project manager. `isDone`: additionally the goal's assignee. |
| DELETE | `/goals/{id}` | — | `204` | admin; project manager |

```
Milestone {id, projectId, name, description, startDate, dueDate, status, completedAt, assignees: UserSummary[],
           goals: Goal[], goalsDone, goalsTotal}
Goal      {id, milestoneId, title, assignee: UserSummary|null, isDone, doneAt}
```
All writes `409` when the project is archived.

## Time entries

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/projects/{id}/time-entries?userId=&from=&to=` | — | `200 {items: TimeEntry[]}` | admin; project manager; member (own only — `userId` forced to self) |
| POST | `/projects/{id}/time-entries` | `{entryDate, hours, note?}` | `201 TimeEntry` · `403` not an *active* member · `400` limits | active member (self) |
| PATCH | `/time-entries/{id}` | `{entryDate?, hours?, note?}` | `200 TimeEntry` | author |
| DELETE | `/time-entries/{id}` | — | `204` | author; project manager; admin |

```
TimeEntry {id, projectId, user: UserSummary, entryDate, hours, note, createdAt}
```

## Audit log (admin only)

| Method | Path | Body | Response | Who |
|---|---|---|---|---|
| GET | `/audit-log?actorId=&entityType=&entityId=&projectId=&action=&from=&to=&limit=50&offset=0` | — | `200 {items: AuditEntry[], total, limit, offset}` · `400` bad limit/offset · `403` for non-admins | admin |

```
AuditEntry {id, occurredAt, actor: UserSummary|null, actorRole, action, entityType, entityId, projectId,
            summary, details, statusCode}
```
This is the only list endpoint that paginates in MVP (`limit` ≤ 200, default 50, newest first).
There are no write endpoints; entries are produced automatically (D13).

## Health

| GET | `/health` | `200 {status:"ok", db:"ok"}` | public | — used by `start-dev.sh`'s reachability check and smoke tests.
