# Enterprise Workforce Predictive Analytics Engine

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

## Setup Instructions

### Environment Variables
1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Configure settings like PostgreSQL credentials and `SECRET_KEY` in the `.env` file.

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
5. Seed the database with development/demo records:
   ```bash
   $env:PYTHONPATH=".;backend" # Windows PowerShell
   # OR on Linux/macOS: export PYTHONPATH=".:backend"
   python app/database/seed.py
   ```
6. Run the machine learning training pipeline to generate the model artifacts:
   ```bash
   python ../ml/training/train.py
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
  - Password: `Password123!`
  - Role: `HR_ADMIN` (Full access, including System Audit Logs)
- **HR Manager**:
  - Email: `manager@workforce.local`
  - Password: `Password123!`
  - Role: `HR_MANAGER` (Full analytics & recommendations, excluding audit logs)
- **Staff Employee**:
  - Email: `employee@workforce.local`
  - Password: `Password123!`
  - Role: `EMPLOYEE` (Restricted profile views, no analytics/recommendations access)

---

## Test & Code Quality Commands

### Backend Tests & Linters
1. Run full pytest suite:
   ```bash
   pytest tests -v
   ```
2. Run Ruff code quality checks:
   ```bash
   ruff check app/ ../ml/
   ```
3. Run Black formatter checks:
   ```bash
   black --check app/ ../ml/
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
