# Changes Made & Roadmap

This document logs what was fixed/added in this pass to take the project from
"scaffolded but broken" to a working, verified, production-styled prototype,
and lists ideas for further work.

## 1. Blocking bugs fixed (app could not start before this)

- **`backend/app/database/session.py`** — the SQLAlchemy engine was created
  from the raw `DATABASE_URL` instead of `settings.SQLALCHEMY_DATABASE_URI`,
  so it tried to load the `psycopg2` driver (not installed; the project uses
  `psycopg` v3) and crashed on the very first DB connection.
- **`backend/app/main.py`** — running the server the way the README documents
  (`cd backend && uvicorn app.main:app`) crashed with
  `ModuleNotFoundError: No module named 'ml'`, because the sibling `ml/`
  package at the repo root was never on `sys.path` outside of `pytest` (which
  gets it for free from `pyproject.toml`'s `pythonpath` setting). Fixed by
  adding the repo root to `sys.path` at the top of `main.py`, computed from
  the file's own location so it works regardless of the working directory.

## 2. Data integrity fix

- **Test isolation** (`backend/tests/conftest.py`) — the pytest suite ran
  directly against the seeded dev database with no isolation. Running tests
  soft-deleted employees and injected stray rows into the same data used for
  demos. Tests now auto-create/migrate/seed a separate
  `workforce_analytics_test` database (override with `TEST_DATABASE_URL`),
  so `pytest` can never touch dev/demo data again.

## 3. Security hardening

- `SECRET_KEY` now fails startup if it's still the placeholder value and
  `ENVIRONMENT=production` (`backend/app/config/settings.py`).
- Fixed a login timing side-channel: a bcrypt verify now always runs, even on
  a lookup miss (using a precomputed dummy hash), so response time no longer
  reveals whether an email is registered (`backend/app/services/auth_service.py`).
- Fixed `BACKEND_CORS_ORIGINS` parsing: a malformed value used to be silently
  passed through instead of raising a clear config error.
- Added a lightweight in-memory rate limiter on `POST /auth/login`
  (`backend/app/security/rate_limit.py`) — 10 attempts/minute per client IP.
  Single-process only; see Roadmap for the production version.

## 4. Frontend

- Fixed a stale header-title bug: `/notifications` and `/employees/:id`
  fell back to a generic "Workforce Management" title instead of showing the
  actual page name (`frontend/src/layouts/Layout.tsx`).
- Added route-level code-splitting (`React.lazy` + `Suspense` in
  `frontend/src/routes/AppRoutes.tsx`). The single 760 KB bundle is now a
  ~245 KB shell plus per-page chunks (largest is the Dashboard's charts, at
  ~400 KB, loaded only when visited).
- Fixed a `nanoid` high-severity npm audit vulnerability (`npm audit fix`).

## 5. Deployment

- Added a full Docker Compose stack: `docker-compose.yml`,
  `backend/Dockerfile` + `docker-entrypoint.sh`, `frontend/Dockerfile` +
  `nginx.conf`. On first boot the backend container runs migrations, trains
  the ML model if no artifact exists, and seeds demo data — but only into an
  empty database, so restarting the container never wipes real data.
  **Built and ran the full stack end-to-end** (Postgres + FastAPI + Nginx)
  and verified it in a real browser before considering it done.
- Documented a quick-start Docker path in `README.md`.

## 6. Demo credentials simplified

Changed the three seeded accounts (`backend/app/database/seed.py`) to:

| Role | Username | Email | Password |
|---|---|---|---|
| HR Admin | `admin` | `admin@workforce.local` | `demo1234` |
| HR Manager | `user` | `user@workforce.local` | `demo1234` |
| Employee | `demo` | `demo@workforce.local` | `demo1234` |

Note: the login form enforces an 8-character minimum password
(`backend/app/schemas/auth.py`), so a literal `1234` was not possible without
weakening that check for all users — `demo1234` was used instead (user's
choice when asked). Updated everywhere these were referenced: seed script,
`conftest.py` fixtures, `test_auth.py`, `LoginPage.tsx`'s one-click demo
buttons, and the README's demo-accounts table.

## 7. Verification performed (not just claimed)

- 22/22 backend pytest tests passing, against the isolated test DB.
- ML training pipeline run for real: Random Forest, 84.1% accuracy, 0.92
  ROC-AUC on a held-out test set.
- Full manual API walkthrough via `curl`: login, dashboard summary,
  employees list, ML prediction endpoint.
- Full browser walkthrough via a Playwright script (headless Chromium):
  login (via the one-click demo button), Dashboard, Employees, Predictions,
  Training, Skills, Recommendations, Departments, Notifications, Audit Logs —
  screenshotted every page, zero console/page/network errors.
- Repeated the full browser walkthrough again against the **Dockerized**
  stack specifically, to confirm the container build is not just "docker
  build succeeds" but actually serves a working app.

---

# Pass 2: access control, ML integrity, self-service, auth hardening, UI

## 8. Access control (data exposure fixes)

Before this pass, almost every read endpoint only checked "is logged in", so
the `EMPLOYEE` demo account could read every colleague's profile, performance
reviews, attrition-risk predictions, and HR recommendations, and could mark
anyone's training enrollment as `COMPLETED`.

- Org-wide HR data is now HR-only (`require_hr`): employee roster, dashboard
  summary, prediction history, model registry, recommendations, org/department
  skill gaps.
- Per-employee data is "self or HR" (`ensure_employee_access` /
  `scope_employee_filter` in `backend/app/security/dependencies.py`): employee
  detail, skill-gap report, performance summary/list, enrollments.
- Users are linked to employee records via a new `employees.user_id` column;
  `GET /auth/me` returns `employee_id`, and `GET /employees/me` returns the
  caller's own profile. The demo employee login is linked to Sarah Johnson
  (`EMP-ENG-018`).
- Employees may enroll themselves and start/drop/rate their own courses, but
  cannot record completion, scores, or certificates.
- Attrition-risk alerts were sent to *every* active user, including
  employees. They now go to HR roles only, and only when someone newly
  escalates to HIGH/CRITICAL (re-running batch predictions no longer floods
  inboxes).

## 9. ML integrity

- The model registry card showed invented metrics ("Gradient Boosting,
  88.5%, v1.0.0") created as a placeholder on first prediction. The registry
  is now synced from the trained artifact's own metadata (v1.1.0, Random
  Forest, 84.1% test accuracy). If no artifact exists, the rule-based
  fallback is registered honestly as `v0-rule-based` with no claimed metrics.
- `confidence_score` was a made-up formula (`0.85 + score/1000`); it is now
  the model's probability for the predicted class.
- The model pickle was re-read from disk on every single prediction; it is
  now cached and reloaded only when the file changes.
- `train.py` and the backend share one registration function, so they can't
  drift apart.

## 10. "Empty on first launch" fixes

- Seeding now scores every employee and generates recommendations, so the
  dashboard, predictions, recommendations, and HR notifications are
  populated immediately (previously 0 at-risk / empty everywhere until someone
  clicked "Run Batch Predictions").
- New `POST /recommendations/generate-all` + "Generate for workforce" button.
  Regeneration no longer re-creates recommendations HR already
  accepted/rejected.
- Seed script could not import the `ml` package when run directly; fixed.

## 11. Auth hardening

- Refresh-token rotation: each refresh revokes the presented token (atomic
  insert into a new `revoked_tokens` denylist keyed by JWT `jti`) and returns
  a new pair; a replayed refresh token gets 401.
- `POST /auth/logout` revokes the access and refresh token server-side.
- Account lockout: 5 consecutive wrong passwords lock the account for 15
  minutes (`423 Locked`), configurable via settings.
- Frontend: concurrent 401s share a single refresh call (required once refresh
  tokens are single-use), auth endpoints never trigger a refresh loop, and
  Logout calls the backend.
- `settings.py` looked for `.env` in `backend/` instead of the repo root, so
  the documented `.env` (incl. `SECRET_KEY`) was silently ignored when running
  locally; fixed.

## 12. Frontend

- New employee **My Dashboard**: skill profile vs. role target, courses that
  close the employee's gaps (one-click enroll), learning progress, own reviews.
- Fixed fields the UI read under the wrong name (all rendered blank):
  "Active Skill Gaps" on profiles, the Mandatory badge, course titles and
  employee names in every enrollment table.
- Employees list had no pagination controls (only the first 15 of 50
  employees were reachable); added pagination and debounced search.
- Employees never assessed by the model showed "Low Risk"; they now show
  "Not assessed". Employee profile shows the stored latest prediction instead
  of requiring a re-run, and no longer hardcodes the algorithm name or
  invents review text when a field is empty.
- Responsive layout: off-canvas sidebar below `lg`, stacked grids, tables
  scroll inside their card.
- Recommendations page: status filters, employee shown on each card,
  priority sorting. Predictions page: real model metrics, employee names,
  risk filter, pagination. Dashboard: real "Pending Actions" KPI instead of
  a hardcoded "Active Courses: 8".
- 0 oxlint warnings (was 5), no `any` left in the codebase.

## 13. CI and migrations

- GitHub Actions (`.github/workflows/ci.yml`): ruff, black, migration
  upgrade/downgrade/upgrade cycle, and pytest against a Postgres service;
  frontend lint and type-check + build.
- The initial migration's downgrade left all 16 Postgres enum types behind,
  so `alembic downgrade base && alembic upgrade head` failed; fixed.

## 14. Verification performed

- 48/48 backend tests (26 new: access scoping, enrollment self-service,
  token rotation/reuse, logout, lockout, registry-matches-artifact, alert
  de-duplication, recommendation idempotency).
- ruff, black, `tsc`, oxlint, and `vite build` all clean.
- Browser (Playwright, headless Chromium) at 1440px and 390px for all three
  roles: zero console errors, zero failed requests. Scripted flows: employee
  login → enroll in a recommended course → start it; employee blocked from
  `/employees`; logout → old token returns 401; lockout message shown on the
  login form.

---

## Why the app currently "looks like a demo" (and what real data would take)

All data is synthetic: employees are procedurally generated (fake names,
`workforce.local` domain), and the ML model is trained on a 5,000-row
synthetic dataset (`ml/datasets/dataset_generator.py`), not real company
history. That's normal for a student/portfolio project — real HR attrition
data isn't something you can legitimately obtain — but here's what would
make it feel less like a demo if you want that for a presentation:

- **Train on a real public dataset** instead of synthetic data — e.g. the
  IBM HR Analytics Employee Attrition dataset on Kaggle. Would require
  reworking the feature set in `ml/training/train.py` to match whatever
  columns that dataset has, and updating `ml/predict.py`'s feature
  extraction to match.
- **Hide the "1-click demo login" buttons** behind a `?demo=1` query flag or
  an env var, so the login screen looks like a real corporate login by
  default, with the shortcuts available only when you want them for a live
  demo.
- **Rename the fake domain** from `workforce.local` to something that reads
  as a real (but fictional) company, e.g. `atlascorp.io`.

---

## Ideas for further work (not done yet)

**Security**
- Swap the in-memory login rate limiter for a shared store (Redis) before
  running more than one backend instance — the current one is per-process
  and won't coordinate across replicas.
- Refresh-token *reuse detection* could go one step further and revoke the
  whole token family when a rotated token is replayed (needs a sessions
  table to enumerate a user's outstanding tokens).
- Tokens live in `localStorage`; moving the refresh token to an `httpOnly`
  cookie would protect it from XSS.

**Testing**
- No frontend unit/component tests yet; the Playwright walkthroughs used for
  verification live outside the repo and could be added as an e2e suite in CI.

**Product**
- No UI for HR to link an employee record to a login account (done in the
  seed for the demo user; would need a field on the employee form).
- Recommendations/predictions could be re-run on a schedule instead of on
  demand.

**Ops**
- `docker-compose.yml` has no resource limits, no HTTPS/TLS termination, and
  the Postgres port is published to the host (fine for local dev, remove for
  a real deployment).
- No structured log shipping / error tracking (e.g. Sentry) wired in despite
  `app/config/logging.py` already doing structured logging.
