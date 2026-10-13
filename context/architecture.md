# Architecture

Simplest architecture that satisfies `requirements.md` inside the boilerplate's constraints.

## Overview

```
Browser (React + MUI, Vite)
   │  fetch /api/v1/...   (Bearer JWT)
   ▼
CloudFront  ──/api/v1*──►  Lambda "v1"  (backend/v1, Python 3.13)   ──psycopg──►  PostgreSQL
   │                                                                               (Aurora / local)
   └── static site from S3
Local dev: Vite :3000 ─► proxy :3001 ─► LocalStack Lambda ─► local Postgres :5432
```

**One Lambda, one modular monolith.** The folder `backend/v1/` is deployed as a single Lambda
and exposed at `/api/v1`. Inside it a small router dispatches to feature packages. See
`decisions.md` D2 for why not one Lambda per entity.

## Backend layers (`backend/v1/`)

```
backend/v1/
├── function.py              # Lambda entry. Parses the Function-URL event, calls app.router, returns response. No logic.
├── requirements.txt         # psycopg[binary], PyJWT, bcrypt, pydantic
├── app/
│   ├── router.py            # Route table: (METHOD, path-pattern) → handler. Strips /api/v1 prefix. Runs auth middleware.
│   ├── http.py              # Request/Response dataclasses, json helpers, error envelope.
│   ├── core/
│   │   ├── db.py            # Connection reuse (module-level), get_conn(), transaction() context manager.
│   │   ├── schema.py        # CREATE TABLE IF NOT EXISTS … + ensure_seed(). Runs once per cold start.
│   │   ├── security.py      # hash/verify password, issue/verify JWT.
│   │   ├── permissions.py   # Pure functions: can_edit_project(actor, project) etc. Single home for RBAC rules.
│   │   ├── audit.py         # record(actor, action, entity, summary, details, status) + body sanitiser. Called only by router.
│   │   └── errors.py        # AppError(status, code, message) subclasses: NotFound, Forbidden, Validation, Conflict.
│   ├── auth/      handlers.py, service.py
│   ├── users/     handlers.py, service.py, repository.py, schemas.py
│   ├── projects/  handlers.py, service.py, repository.py, schemas.py
│   ├── milestones/ handlers.py, service.py, repository.py, schemas.py   # milestones + goals
│   ├── time_entries/ handlers.py, service.py, repository.py, schemas.py
│   └── audit_log/ handlers.py, service.py, repository.py, schemas.py    # read-only list endpoint (admin)
└── tests/
    ├── unit/                # services + permissions with fake repositories
    └── integration/         # handlers against a real local Postgres (test database)
```

### Responsibilities (strict)

| Layer | File | Does | Must NOT |
|---|---|---|---|
| **Entry** | `function.py` | Convert Lambda event ↔ HTTP response. | Contain routing, SQL or business rules. |
| **Router / middleware** | `app/router.py` | Match method+path, parse path params, decode JWT into `actor`, call handler, map `AppError` → response, **write the audit entry** for routes that declare an `audit` action (D13). | Know about specific entities. |
| **Handler** (= Controller) | `*/handlers.py` | Parse body/query into a DTO (`schemas.py`), call one service function, return `Response`. | Contain SQL, permission logic, or multi-step business logic. |
| **DTO / schema** | `*/schemas.py` | Pydantic models for request validation and response shaping (e.g. strip `password_hash`, hide `salary` from non-admins). | Touch the database. |
| **Service** | `*/service.py` | Business rules, permission checks (via `core/permissions.py`), orchestration across repositories, transactions. | Build HTTP responses or parse raw events. |
| **Repository** | `*/repository.py` | All SQL for one aggregate. Returns plain dicts/dataclasses. | Make decisions; raise HTTP-ish errors (return `None`, service decides). |
| **Model** | `core/schema.py` | Table definitions (DDL) — the only place column names are declared. | — |

Rule of thumb: a request touches exactly one handler, one service, one or more repositories.
Handlers never call repositories directly; services never import from `handlers`.

## Frontend layers (`frontend/src/`)

```
frontend/src/
├── main.jsx, App.jsx        # Providers (theme, router, auth), route table
├── services/
│   ├── client.js            # fetch wrapper: base URL, Bearer header, JSON, error → ApiError
│   └── {auth,users,projects,milestones,timeEntries}.js   # one function per endpoint, no UI
├── auth/
│   ├── AuthContext.jsx      # token + current user in memory/localStorage, login/logout
│   └── RequireRole.jsx      # route guard
├── pages/                   # One folder per screen; owns data loading for that screen
│   ├── LoginPage/
│   ├── DashboardPage/       # role-aware landing
│   ├── ProjectsPage/        # list (role-filtered)
│   ├── ProjectDetailPage/   # tabs: overview, members, milestones, time
│   ├── UsersPage/           # admin
│   ├── TeamPage/            # manager/employee: immediate team
│   └── ProfilePage/
├── components/              # Reusable, presentational, no fetching (DataTable, StatCard, ConfirmDialog, FormDialog, StatusChip, RoleGate)
├── hooks/                   # useApi(fn) → {data, loading, error, refetch}; useAuth()
└── utils/                   # formatters (hours, money, dates), capacity math (mirrors backend formulas)
```

Rules: pages fetch via `services/*` modules only; components receive data by props; permission
visibility uses `RoleGate`/`useAuth()` but the server is the enforcer.

## Request lifecycle (example: manager adds a member)

1. `ProjectDetailPage` → `services/projects.addMember(projectId, {userId, hoursAssigned})`
2. `client.js` sends `POST /api/v1/projects/{id}/members` with Bearer token.
3. `function.py` → `router.py`: decode JWT → `actor`; match route → `projects.handlers.add_member`.
4. Handler validates body with `AddMemberRequest` DTO → `projects.service.add_member(actor, project_id, dto)`.
5. Service: load project (repo) → `permissions.assert_can_manage_members(actor, project)` → check user exists and is an employee → `repo.insert_member` in a transaction → return member dict.
6. Handler returns `201` with `MemberResponse`. Errors raised as `AppError` are mapped by the router to the standard envelope.
7. Router sees the route's `audit="project.member_add"`, builds the summary from the response (`Added Jane Doe to project "X"` via the handler-supplied `Response.audit_summary`), sanitises the body, and inserts the `audit_log` row.

## Cross-cutting

- **Schema init**: `core/schema.py` runs idempotent DDL + seeds the first admin on cold start (guarded by a module flag). No separate migration step. (D4)
- **Config**: all from env vars injected by Terraform (`POSTGRES_*`, `IS_LOCAL`) plus `JWT_SECRET` (D5).
- **Logging**: Python `logging` to CloudWatch; log method, path, actor id, status, duration; never log tokens/passwords.
- **Errors**: one envelope `{"error": {"code": "...", "message": "...", "details": {...}}}`.
- **CORS**: handled by Function URL config + local proxy; the Lambda does not set CORS headers itself.
