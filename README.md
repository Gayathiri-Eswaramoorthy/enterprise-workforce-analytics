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
2. Configure settings like PostgreSQL credentials in the `.env` file.

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Check health:
   ```bash
   curl http://localhost:8000/api/v1/health
   ```

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
