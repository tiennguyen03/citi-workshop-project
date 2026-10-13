# Security

## Authentication

- **Mechanism**: username + password → JWT (HS256, PyJWT). Token carries `{sub: userId, role, exp, iat}` only. No refresh token in MVP (S4); lifetime 8 h.
- **Passwords**: bcrypt (cost 12 in AWS, 4 in tests). Never logged, never returned, never compared in plaintext. Minimum 8 chars on creation.
- **Secret**: `JWT_SECRET` env var. Locally falls back to a fixed dev value **only when `IS_LOCAL=true`**; in AWS a missing secret is a startup error. See `decisions.md` D5 for how it is injected.
- **Transport**: Function URL / CloudFront are HTTPS. The frontend stores the token in `localStorage` (accepted trade-off for a 3-day MVP; no HttpOnly cookie because the API is on a different origin locally).
- **Middleware**: `router.py` rejects every request except `POST /auth/login` and `GET /health` without a valid, unexpired token (`401 UNAUTHENTICATED`). It loads the user from the DB on each request so deactivation and role changes take effect immediately; an inactive user gets `401`.
- Local proxy must forward the `Authorization` header (one-line change to `bin/proxy-server.js`, D7).

## Authorization model

All rules live in `backend/v1/app/core/permissions.py` as pure functions taking `(actor, resource)`.
Services call them; handlers and repositories never make permission decisions. The frontend mirrors
them for visibility only.

### Role matrix

| Action | Admin | Manager | Employee |
|---|---|---|---|
| Create user / set role, salary, title, manager, active | ✔ | ✖ | ✖ |
| Edit name/email | any | direct reports | self |
| View user salary | ✔ | direct reports | own only (profile page) |
| List users | all | own reports | ✖ (use `/users/{self}/team`) |
| Create project / set manager / archive / unarchive / see archived | ✔ | ✖ | ✖ |
| Edit project info, budget, dates | ✔ | own projects | ✖ |
| Add/remove members, set hours assigned | ✔ | own projects | ✖ |
| View project | all | own projects | current + past projects (non-archived) |
| View project cost/budget | ✔ | own projects | ✖ |
| Create/edit/complete milestone, create/edit/delete goal | ✔ | own projects | ✖ |
| Toggle goal `isDone` | ✔ | own projects | own assigned goals |
| Mark project complete | ✔ | own projects | ✖ |
| Log time | ✔ (as self, if member) | ✔ (as self, if member) | own, on assigned projects |
| Delete time entry | any | own projects | own |
| View audit log | ✔ | ✖ | ✖ |
| Write/edit/delete audit log | ✖ (append-only, system-written) | ✖ | ✖ |

"Own projects" = `project.manager_id == actor.id`. "Direct reports" = `user.manager_id == actor.id`.

### Ownership helpers

```
is_admin(actor)
manages_project(actor, project)        -> admin or project.manager_id == actor.id
is_project_member(actor, project)      -> row in project_members
can_view_project(actor, project)       -> admin, manager-of, or member; archived ⇒ admin only
can_edit_user(actor, target, fields)   -> admin any; manager name/email of reports; self name/email
can_toggle_goal(actor, goal, project)  -> manages_project or goal.assignee_id == actor.id
```

### Invariants enforced server-side (not just in UI)
- Archived project ⇒ every write to it, its milestones, goals, members, time entries returns `409 CONFLICT`.
- Project complete ⇒ milestones cannot be reopened; members unchanged.
- One active project per employee (M8) and one open milestone per employee per project (M13a) — each enforced in the service transaction and by a partial unique index, never only in the UI.
- Time can be logged only by an *active* member of the project.
- Non-admin can never set `role`, `salary`, `jobTitle`, `managerId`, `isActive`, `archived`, `projects.managerId`. Unknown/forbidden fields in a PATCH are rejected with `400`, not silently ignored (prevents privilege escalation via extra fields).
- An admin cannot deactivate themselves or demote the last admin.

## Sensitive data

| Data | Handling |
|---|---|
| `password_hash` | Never selected into DTOs; repository `SELECT` lists exclude it except in `auth.find_for_login`. |
| `salary` | Returned only to admin / the user's manager / the user. Cost figures derived from salary are returned only to admin and the project manager. |
| JWT secret, DB password | Env vars only; never in code, logs or git. `ENVIRONMENT.config` is gitignored. |
| Tokens | Never logged. Frontend clears on logout and on any `401`. |
| Logs | method, path, actor id, status, duration; request bodies are not logged. |
| Audit log `details` | Sanitised copy of the request body: keys `password`, `token`, `authorization` removed; `salary` replaced with `"[redacted]"`. Admin-only read. |

## Audit trail (M19)
- Written by `router.py` in a `finally`-style hook after the handler returns, for every request whose
  route declares an `audit` action (all mutating routes + login). Reads are not audited (they'd dwarf
  the log and carry no change information) — this is an explicit decision (D13).
- The audit insert runs in the **same transaction** as the mutation where the service exposes one, so
  a logged action always corresponds to a committed change; a failed mutation is logged with its
  status code only for `auth.login_failed` (to spot brute force), not for validation errors.
- Nothing in the application can update or delete `audit_log` rows; the repository exposes only
  `insert` and `list`.

## Input handling
- All bodies validated by pydantic DTOs with explicit field whitelists (`extra="forbid"`).
- All SQL is parameterised (psycopg placeholders); no string formatting of user input into SQL.
- IDs validated against `^[A-Z0-9]{6}$` before hitting the DB.
- Response `Content-Type: application/json`; the API never reflects raw input in error messages beyond field names.

## Known gaps (documented, accepted for MVP)
- No rate limiting on login (Function URL has none). Mitigation: bcrypt cost makes brute force slow; note in README.
- No token revocation list; deactivating a user is checked per request instead.
- Bandit (CI) must pass: avoid `assert` for validation, avoid `random` for IDs (use `secrets`).
