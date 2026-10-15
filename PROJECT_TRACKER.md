# Project Tracker

An internal tool for a company that runs projects with borrowed people: an admin creates projects and
users, managers staff their projects and break them into milestones and goals, and employees log the
hours they spend. Everything is measured three ways: **time** (hours against capacity), **cost**
(salary-based spend against budget) and **resources** (who is free, who is stretched, who is on what).

Live site: https://d2f2rff70xkxny.cloudfront.net (API under `/api/v1`).
Design notes, contract and decisions live in [`context/`](context/); this file is the map.

## Accounts for a walkthrough

| Role | Username | Password | What to look at |
|---|---|---|---|
| Admin | `admin` | `Admin123!` | Dashboard health board, Users, Audit log, archiving |
| Manager | `marcus.bell` | `Password1!` | Two projects (one at risk, one complete), Due soon, My team |
| Manager | `priya.natarajan` | `Password1!` | One on-track project with four milestones |
| Employee | `john.doe` | `Password1!` | Current project, goals, logging time |

Every other seeded person also signs in with `Password1!`.

## Architecture in one picture

```
Browser (React 19 + Vite + MUI v9)
   │  fetch /api/v1/*  (JWT in Authorization header)
   ▼
CloudFront ──► S3 (static site)
   └─ /api/v1* ──► Lambda function URL (Python 3.13, one function)
                        │  psycopg
                        ▼
                  Aurora PostgreSQL Serverless v2
```

Locally the same shape runs on LocalStack (Lambda + S3) and a local PostgreSQL, started by the
workshop's `./bin/start-dev.sh`. The Vite dev server is on port 3000 and proxies `/api` to the Lambda
through `bin/proxy-server.js` on port 3001.

### Backend (`backend/v1/`)

One Lambda, one hand-rolled router, organised by feature. Each feature folder has the same four files:

| File | Job |
|---|---|
| `handlers.py` | Parse the HTTP request, call the service, shape the response |
| `schemas.py` | Pydantic request/response models (camelCase on the wire) |
| `service.py` | Business rules and permission checks |
| `repository.py` | SQL, composed with `psycopg.sql`, no string formatting |

Features: `auth`, `users`, `projects`, `milestones` (with goals), `time_entries`, `dashboard`,
`audit_log`, `health`. Shared code sits in `core/`: `db.py` (connection, schema creation, demo seed),
`permissions.py` (every role rule in one place), `audit.py` (the append-only log, written by the router
for every mutating route declared with `audit=`), `paging.py`, `ids.py` (6-character random IDs).

There is no migration tool. `core/schema.py` creates the tables on first request; partial unique
indexes enforce "one active project per employee" and "one open milestone per employee per project"
at the database, so the rules hold even under concurrent writes.

### Frontend (`frontend/src/`)

| Folder | Job |
|---|---|
| `pages/` | One folder per screen; a page fetches through `hooks/useApi` and renders shared components |
| `services/` | One file per API feature, all through `client.js` (adds the token, maps errors) |
| `components/` | The visual system: `DataTable`, `StatCard`, `Tag`, `ProgressBar`, `SectionHeading`, `ProjectCard`, … |
| `auth/` | Session context and route guards |
| `utils/` | Pure helpers: dates, formatting, health, roles |
| `theme.js` | The only place colours and type live; light and dark schemes |

Per-role landing pages share one `GET /dashboard` call. Lists are searched and paged on the server
(`limit`, `offset`, `q`) with the page kept in the URL so any filtered view is a link.

## Running it

Prerequisites: Docker, Node 22, Python 3.13, Terraform, the AWS CLI (the workshop image has all of them).

```bash
# local stack: LocalStack, Postgres, the Lambda with hot reload, the Vite dev server
./bin/start-dev.sh
# then open http://localhost:3000
```

Demo data loads on first request when the database holds only the bootstrap admin. To reload it,
truncate the tables, touch `backend/v1/function.py` and call `/api/v1/health` once.

```bash
# AWS, using only the workshop scripts
./bin/deploy-backend.sh aws     # Terraform: Lambda, function URL, CloudFront route, Aurora
./bin/deploy-frontend.sh aws    # Vite build, S3 sync, CloudFront invalidation
```

The Aurora cluster pauses after five idle minutes; the first request afterwards takes 15–30 s, which
the backend absorbs with a longer connect timeout and one retry.

## Tests

| Suite | Command | Count |
|---|---|---|
| Backend unit + integration (pytest, local Postgres) | `cd backend/v1 && .venv/bin/pytest -q --cov=app` | 103, 97 % coverage |
| Backend lint and security | `.venv/bin/ruff check .` · from the repo root `backend/v1/.venv/bin/bandit -r ./backend` | clean |
| Frontend components and pages (Vitest + Testing Library) | `cd frontend && npx vitest run` | 105 |
| Frontend lint | `cd frontend && npm run lint` | clean |
| Browser suite (Playwright, against the local stack) | `cd frontend && npm run test:e2e` | 13 |

The browser suite creates its own managers, employees and projects through the API, so it reruns
without reseeding; reseed afterwards to clear them.

## The rules the code enforces

- Exactly three roles. Permission checks run server-side on every endpoint; the UI only hides what a
  role cannot do.
- An employee is on at most one active project, and on at most one open milestone within it. Both are
  database constraints, not just service checks.
- No hard deletes of projects: archive, admin-only visibility, unarchive. Goal and time-entry deletions
  are audited with the full payload.
- Capacity is working days × 8 h per member for the project's dates; cost is logged hours × salary / 2080.
- Progress means goals: completed goals over total goals, the same number on every screen. Hours are a separate
  measure (capacity used, assigned hours used, this week's workload), so a manager can compare work done with
  time and money spent.
- A project cannot be completed while a milestone is open; a completed project can be archived.
- Every action by every role is written to the audit log with actor, action, entity and a summary;
  only admins read it; nothing in it is ever edited.

## Trade-offs

- **One Lambda, one router.** The workshop deploys one function per folder; a hand-rolled router kept
  cold starts near one second at 128 MB, where a framework would not have fitted.
- **Offset paging, not cursors.** Lists are sorted by stable keys and writes are rare; offsets are
  enough and keep the page number in the URL meaningful.
- **Computed health, not stored.** A project's health (late, at risk, needs setup, done-not-archived,
  on track) is derived on every request from facts already in the row, so the admin board and the
  manager cards can never disagree.
- **Calendar dates only.** Entries and milestones are dates, not timestamps; "today" uses the server
  clock for rules and the browser clock for cues.
- **Visual system in shared components.** Status grammar, progress treatment, paging, summaries and
  icon actions are each one component, so pages cannot drift apart. Decisions D17–D25 record the rules.

## Known gaps

| Gap | Today | If it mattered |
|---|---|---|
| Notifications | Nothing is sent | SES on due dates, assignment, budget overrun |
| Session refresh | 8-hour JWT, re-login on expiry | Sliding refresh token |
| Hours per day | At most 24 h per entry, no daily cap across entries | Reject when a day would exceed 24 h |
| Capacity model | Weekdays × 8 h for the whole project; join date, holidays and leave are ignored | Per-member date ranges |
| Concurrency | Last write wins on edits; the uniqueness rules are database-enforced | `updated_at` checks |
| Audit export | Filters and paging, no CSV | Export endpoint |
| Dependencies between milestones | Not modelled | "Blocked by" links with completion gating |
| RAG status | Column exists, no UI | Manager-set Red/Amber/Green with a reason |

The full table, with the reasoning, is decision D18 in [`context/decisions.md`](context/decisions.md).
