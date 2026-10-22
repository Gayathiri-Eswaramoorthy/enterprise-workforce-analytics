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
  - Role: `HR_ADMIN` (Full administrative authority: user management & role assignment, employee CRUD, departments, configuration, and compliance audit logs)
- **HR Manager**:
  - Email: `user@workforce.local`
  - Password: `demo1234`
  - Role: `HR_MANAGER` (Workforce analytics: view attrition risk predictions, investigate contributing risk factors, log retention interventions, recommend training, review employee discussion requests, and document follow-up outcomes. Restricted with 403 on user management, audit logs, and employee mutations)
- **Staff Employee** (linked to employee record Sarah Johnson, `EMP-ENG-018`):
  - Email: `demo@workforce.local`
  - Password: `demo1234`
  - Role: `EMPLOYEE` (Self-service "My Dashboard": view personal skill profile, optional growth pathways, voluntary course enrollments, track lesson progress, and request 1-on-1 discussions with HR)

---

## Security & Access Model

- **Clear Role Separation**:
  - **HR Admin**: Manages user accounts (`/users`), system roles, employee records (`/employees` CRUD), departments, and compliance audit logs (`/audit-logs`).
  - **HR Manager**: Operational HR workspace for attrition analytics, employee risk investigations, structured retention interventions (`/retention`), and reviewing employee discussion requests. Blocked from administrative user management and audit log tampering.
  - **Employee**: Dedicated private dashboard. Employees cannot access organization-wide rosters, colleagues' skill profiles, or predictive attrition scores.
- **Privacy & Data Scoping**: All employee-facing endpoints verify user identity via `ensure_employee_access`. Requests attempting to inspect another employee's records return HTTP 403 Forbidden.
- **Voluntary Learning Enrollment**: Predicted risk scores and identified skill gaps do NOT trigger automated forced training enrollments. Learning recommendations are presented as optional growth opportunities, and employees voluntarily self-enroll.
- **Attrition-Risk Workflow**:
  - Predicted high risk represents statistical model correlation, not an intent to resign.
  - HR Managers review employee circumstances and select appropriate interventions (`WORKLOAD_REVIEW`, `CAREER_DEVELOPMENT`, `MANAGER_CHECK_IN`, `TRAINING`, `COMPENSATION_REVIEW`, `FLEXIBLE_WORK`, `OTHER_SUPPORT`).
  - Follow-up outcomes (`EMPLOYED`, `DEPARTED`, `PENDING`) and observational effectiveness (`HELPFUL`, `NEUTRAL`, `UNHELPFUL`, `PENDING_ASSESSMENT`) are logged based on factual milestones without claiming causal ML prevention.
- **Tokens**: Access tokens expire after 30 minutes. Refresh tokens are single-use: every `POST /auth/refresh` revokes the presented token and returns a new pair.
- **Login Protection**: 10 login attempts per minute per IP rate limit, and 15-minute lockout after 5 consecutive incorrect passwords.

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

---

## Integrated Employee Learning & Retention Tracking Module

The application provides an enterprise learning, skill assessment, and longitudinal retention tracking system integrated directly into PostgreSQL and the React frontend.

### 1. Learning Lifecycle & Persistent Course Progress
- **Course Catalog & Lesson Content**: Courses (e.g. *Python Fundamentals*, *SQL and Database Skills*, *Cloud Fundamentals*) contain sequenced lessons with full markdown content, code examples, external reference links, and estimated completion times.
- **Lesson-Level Completion**: Employees mark required lessons complete via `POST /api/v1/learning/lessons/{lesson_id}/complete`. Progress is calculated server-side as `(completed_required_lessons / total_required_lessons) * 100%`.
- **Session & Refresh Persistence**: Lesson completions are persisted in the PostgreSQL `lesson_completions` table with unique constraints on `(enrollment_id, lesson_id)` to prevent duplication and progress inflation.
- **Ownership & Validation**: Employees can only mark completions on courses they are actively enrolled in; submitted lesson IDs are strictly validated against the employee's enrollment course.

### 2. Knowledge Assessment Quizzes & Completion Gating
- **Answer Security**: The quiz API (`GET /api/v1/learning/courses/{course_id}/quiz`) omits `is_correct` flags from answer options to prevent client inspection.
- **Server-Side Scoring**: Submissions are evaluated strictly on the backend (`POST /api/v1/learning/courses/{course_id}/quiz/submit`). Scores, pass/fail status, attempt numbers, and detailed question breakdowns with educational explanations are returned post-submission.
- **Passing Threshold**: A configurable passing threshold (default 70.00%) and max attempts limit (default 3) are enforced per quiz.
- **Course Completion Gate**: A course automatically transitions to `COMPLETED` status only when **all required lessons are completed** AND the attached knowledge assessment quiz is **passed**. Employees cannot artificially set completion status from the client.

### 3. Before-and-After Skill Assessment & Gap Recalculation
- **Pre-Training Baseline**: HR records an initial baseline assessment score (%) before training commences.
- **Post-Training Evaluation**: Following course or capability development, a post-training assessment is recorded.
- **Measurable Score Delta**: Compares pre- and post-training scores, displaying the delta in percentage points (e.g. `+25.00%`).
- **Proficiency Reassessment**: When authorized evaluators record an assessed practical proficiency (1–5 scale), the employee's `EmployeeSkill` record is updated and the remaining skill gap against their `RoleSkill` target is automatically recalculated.
- **Separation of Concerns**: Quiz scores measure course-specific knowledge retention; practical skill proficiency levels reflect verified hands-on capability.

### 4. HR Training & Development Dashboard
- Accessible at `/training` under the **HR Learning Analytics & Assessments** tab.
- **Program Summaries**: Real-time breakdown per course showing enrolled, not started, in progress, completed, overdue (>60 days inactive), average lesson completion %, and quiz pass rates.
- **Learner Follow-up Support Queue**: Automatically identifies employees with stalled course progress (>60 days inactive with <50% completion) or repeated quiz difficulties (>=2 failed attempts).
- **Organization Assessment Log**: Displays paired baseline vs. post-training evaluations across all departments with score improvements and current proficiency ratings.
- **Record Assessment Modal**: HR managers can evaluate employees, assign assessment scores, update proficiency, and log evaluator notes.

### 5. Retention Intervention & Longitudinal Follow-up Tracking
- Accessible at `/recommendations` under the **Retention Interventions & Follow-up** tab.
- **Recommendation Integration**: Attrition-risk recommendations directly link to structured retention interventions (via the "Track Intervention" action).
- **Intervention Categories**: Structured plans including `WORKLOAD_REVIEW`, `CAREER_DEVELOPMENT`, `MENTORING`, `TRAINING`, `COMPENSATION_REVIEW`, and `FLEXIBLE_WORK`.
- **Lifecycle Status**: Tracks workflow transitions through `OFFERED` → `ACCEPTED` / `DECLINED` → `COMPLETED`.
- **Scheduled Milestones**: Quick-select buttons for 3-month and 6-month check-in dates.
- **Factual Employment Outcomes**: Documented employment status (`EMPLOYED`, `DEPARTED`, `PENDING`) with verifiable notes.
- **Data Governance Note**: Interventions record factual administrative events and observational employment status. Causal prevention claims are explicitly avoided, and ML feature schemas remain decoupled from these intervention logs.

### 6. New Database Tables & Alembic Migration
Migration `8fbca280306f_add_learning_and_retention_tables.py` introduces:
- `course_lessons`: Sequenced educational content, markdown, durations, and required flags.
- `lesson_completions`: Granular lesson-level employee progress with `(enrollment_id, lesson_id)` uniqueness.
- `course_quizzes`: Multiple-choice quizzes with configurable passing scores and attempt limits.
- `quiz_questions` & `quiz_options`: Multiple-choice question banks and option choices.
- `quiz_attempts`: Server-scored historical attempts, payloads, and feedback breakdowns.
- `skill_assessments`: Baseline and post-training skill evaluations, proficiency ratings, and evaluator tracking.
- `retention_interventions`: Structured HR interventions, milestone follow-up dates, and factual retention outcomes.

### 7. Core API Endpoints
| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `GET` | `/api/v1/learning/my-courses` | Enrolled courses with calculated progress % & quiz status | Employee / HR |
| `GET` | `/api/v1/learning/courses/{id}/lessons` | Sequenced lesson list with completion flags | Employee / HR |
| `POST` | `/api/v1/learning/lessons/{id}/complete` | Mark required lesson complete and update progress | Enrolled Employee |
| `GET` | `/api/v1/learning/courses/{id}/quiz` | Sanitized quiz questions (answers stripped) | Enrolled Employee |
| `POST` | `/api/v1/learning/courses/{id}/quiz/submit` | Submit answers, calculate score, check threshold | Enrolled Employee |
| `GET` | `/api/v1/learning/hr-dashboard` | Organization learning metrics & learner support queue | HR Admin / Manager |
| `POST` | `/api/v1/analytics/assessments` | Record baseline or post-training skill assessment | HR Admin / Manager |
| `GET` | `/api/v1/analytics/assessments/comparison/{id}` | Paired baseline vs post scores and recalculated gap | Employee / HR |
| `GET` | `/api/v1/retention/interventions` | Query retention interventions with status/outcome filters | HR Admin / Manager |
| `POST` | `/api/v1/retention/interventions` | Log new structured retention intervention | HR Admin / Manager |
| `PUT` | `/api/v1/retention/interventions/{id}` | Update intervention status and document retention outcome | HR Admin / Manager |

---

## Machine Learning Pipeline & Benchmark Evaluation

The workforce attrition engine is trained on the publicly available, fictional **IBM HR Analytics Employee Attrition** benchmark dataset (`ml/datasets/WA_Fn-UseC_-HR-Employee-Attrition.csv`), replacing the previous purely synthetic training workflow. The original synthetic dataset (`synthetic_workforce_data.csv`) and generator (`dataset_generator.py`) remain preserved and unchanged in the repository.

### Dataset Provenance & Target Definition
- **Source**: Fictional HR analytics benchmark published by IBM data scientists (1,470 records, 35 attributes).
- **Target Variable**: `Attrition` (`Yes` = 1 [at risk], `No` = 0 [retained]).
- **Class Distribution**: Severe class imbalance with 1,233 negative cases (83.88%) and 237 positive cases (16.12%) — a ~5.2:1 ratio.
- **Excluded Features**: Non-predictive identifiers and zero-variance constants are excluded during preprocessing: `EmployeeNumber` (identifier), `EmployeeCount` (constant 1), `Over18` (constant 'Y'), and `StandardHours` (constant 80).

### Preprocessing & Leakage Prevention
- **Split Strategy**: Stratified 80/20 train/test split (`random_state=42`) preserves the target proportion across splits and prevents data leakage.
- **Encapsulated Pipeline**: Preprocessing transforms are fitted exclusively on the training split and serialized directly with the Random Forest classifier into a unified `Pipeline` artifact (`ml/artifacts/workforce_risk_model.joblib`), ensuring identical preprocessing during live inference:
  - Numerical features: `SimpleImputer(strategy='median')` followed by `StandardScaler`.
  - Categorical features: `SimpleImputer(strategy='constant', fill_value='missing')` followed by `OneHotEncoder(handle_unknown='ignore')`.

### Feature Alignment & Application Integration
Because the application's PostgreSQL database does not track compensation metrics (e.g. `MonthlyIncome`) or workplace survey ratings (e.g. `JobSatisfaction`), the deployable serving pipeline is trained on the 8 features supported by the application database without fabricating missing attributes:
1. `Department`: Mapped to standard benchmark categories (`Research & Development`, `Sales`, `Human Resources`).
2. `Gender`: Mapped from `employee.gender` (`Male`, `Female`).
3. `OverTime`: Mapped from `employee.overtime_frequency` (`OCCASIONAL`/`FREQUENT` -> `'Yes'`, `NONE` -> `'No'`).
4. `Age`: Derived from `employee.date_of_birth` in completed years.
5. `JobLevel`: Derived from `job_role.grade_level` (1..10 scale mapped to 1..5 scale).
6. `YearsAtCompany`: Derived from `employee.date_of_joining` in completed years.
7. `PerformanceRating`: Derived from latest review `overall_rating` (unclamped 1..5), with pipeline median imputation if reviews are unrecorded.
8. `TrainingTimesLastYear`: Count of `training_enrollments`.

### Actual Evaluation Results (Held-Out 20% Stratified Test Split, 294 Records)

| Metric | Dummy Baseline (Majority Class) | Full 30-Feature Benchmark | Deployable 8-Feature Model (v2.0.0-ibm) |
|---|---|---|---|
| **Accuracy** | 84.01% | 82.99% | **77.89%** |
| **Precision** | 0.00% | 47.06% | **38.16%** |
| **Recall** | 0.00% | 51.06% | **61.70%** (29/47 at-risk caught) |
| **F1-Score** | 0.00% | 48.98% | **47.15%** |
| **ROC-AUC** | 0.5000 | 0.8029 | **0.7166** |
| **5-Fold CV Accuracy** | 83.88% | 85.37% | **78.74%** |
| **5-Fold CV F1-Score** | 0.00% | 48.77% | **46.84%** |
| **Test Confusion Matrix** | `[[247, 0], [47, 0]]` | `[[220, 27], [23, 24]]` | `[[200, 47], [18, 29]]` |

*Why accuracy alone is insufficient*: In an imbalanced workforce (84% retention), a trivial baseline predicting "No" achieves 84.01% accuracy while completely failing to identify a single leaving employee (0% recall). The deployable Random Forest with `class_weight='balanced'` prioritizes recall (61.70%), catching nearly two-thirds of at-risk employees.

### Retraining Instructions
To retrain the model and re-export serialized artifacts and metadata:
```bash
python ml/training/train.py
```
This updates `ml/artifacts/workforce_risk_model.joblib` and `ml/artifacts/model_metadata.joblib`, and synchronizes the active model entry in PostgreSQL `ModelRegistry`.

### Limitations
- The IBM dataset is a fictional benchmark, not data from a live operating business.
- Inferences made on seeded demonstration employees reflect statistical patterns in the benchmark dataset, not causal relationships in a real corporate workforce.
