# Enterprise Workforce Predictive Analytics Engine

[![CI](https://github.com/Gayathiri-Eswaramoorthy/enterprise-workforce-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/Gayathiri-Eswaramoorthy/enterprise-workforce-analytics/actions/workflows/ci.yml)

An enterprise HR analytics platform designed for talent retention forecasting, ML-based employee attrition prediction, and automated skill mapping.

## Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, React Router, Axios, Recharts
- **Backend**: FastAPI, SQLAlchemy, Alembic, Pydantic, PostgreSQL
- **Machine Learning**: Python, Scikit-learn, Pandas, NumPy, Joblib

---

## Project Structure

```text
enterprise-workforce-analytics/
├── backend/          # FastAPI backend services
│   └── app/          # Modular API layers
└── frontend/         # React SPA
    └── src/          # Feature-based components and pages
```

---

## Quick Start (Docker)

The fastest way to run the full stack (PostgreSQL + FastAPI backend + React frontend) is via Docker Compose. On first boot it automatically runs migrations, trains the ML model if no artifact exists, and seeds demo data.

```bash
cp .env.example .env
# Generate a real SECRET_KEY and paste it into .env:
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up --build
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API / Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

Data persists in a named Docker volume (`pgdata`) across restarts; the seed step only runs against an empty database, so it won't wipe existing records on subsequent `docker compose up` runs. Use `docker compose down -v` to fully reset.

---

## Setup Instructions (Manual / Local Development)

### Environment Variables
1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Configure PostgreSQL credentials and generate a real `SECRET_KEY` in the `.env` file:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
   The app refuses to start with the placeholder `SECRET_KEY` when `ENVIRONMENT=production`.

### Backend & Database Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\Activate.ps1
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations using Alembic:
   ```bash
   alembic upgrade head
   ```
5. *(Optional)* Retrain the machine learning model. A trained artifact is already committed in
   `ml/artifacts/`, so this is only needed if you change the training pipeline or dataset:
   ```bash
   python ../ml/training/train.py
   ```
6. Seed the database with demo records. This also scores every employee with the ML model and
   generates recommendations, so the dashboards are populated on first launch:
   ```bash
   python -m app.database.seed
   ```
7. Start the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
8. Swagger Documentation is available at:
   - **OpenAPI / Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Alternative Redoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Build the application for production:
   ```bash
   npm run build
   ```

---

## Demo Accounts & Role-Based Logins
You can log in to the web platform on [http://localhost:5173/](http://localhost:5173/) using these pre-seeded development credentials:

- **HR Administrator**:
  - Email: `admin@workforce.local`
  - Password: `demo1234`
  - Role: `HR_ADMIN` (Full access, including System Audit Logs)
- **HR Manager**:
  - Email: `user@workforce.local`
  - Password: `demo1234`
  - Role: `HR_MANAGER` (Full analytics & recommendations, excluding audit logs)
- **Staff Employee** (linked to employee record Sarah Johnson, `EMP-ENG-018`):
  - Email: `demo@workforce.local`
  - Password: `demo1234`
  - Role: `EMPLOYEE` (Self-service "My Dashboard": own skill gaps, course enrollment, own reviews)

---

## Security & Access Model

- **Role-scoped data.** Organization-wide HR data (employee roster, dashboard KPIs, attrition-risk
  predictions, recommendations, org/department skill gaps) is restricted to `HR_ADMIN` and
  `HR_MANAGER`. An `EMPLOYEE` can only read their *own* profile, skill gaps, reviews, and
  enrollments - requests for anyone else return `403`. Attrition-risk alerts are only ever sent
  to HR users.
- **Self-service training.** Employees can enroll themselves in courses, start or drop them, and
  leave a rating. Completion, scores, and certificates are recorded by HR.
- **Tokens.** Access tokens expire after 30 minutes. Refresh tokens are single-use: every
  `POST /auth/refresh` revokes the presented token and returns a new pair, so a replayed refresh
  token is rejected. `POST /auth/logout` revokes both the access and refresh token server-side.
- **Login protection.** 10 login attempts per minute per IP (rate limit), and an account is locked
  for 15 minutes after 5 consecutive wrong passwords (`LOGIN_MAX_FAILED_ATTEMPTS`,
  `LOGIN_LOCKOUT_MINUTES`).

---

## Test & Code Quality Commands

CI (`.github/workflows/ci.yml`) runs all of the checks below on every push to `main` and on every
pull request.

### Backend Tests & Linters
Run these from the repository root:

1. Run full pytest suite:
   ```bash
   pytest -v
   ```
   Tests run against a separate `workforce_analytics_test` database (auto-created, migrated, and seeded on first run) so the suite never touches your seeded dev/demo data. Override the target with `TEST_DATABASE_URL` if needed.
2. Run Ruff code quality checks:
   ```bash
   ruff check backend ml
   ```
3. Run Black formatter checks:
   ```bash
   black --check backend ml
   ```

### Frontend Linters & Builds
1. Lint the frontend:
   ```bash
   npm run lint
   ```
2. Build validation:
   ```bash
   npm run build
   ```
