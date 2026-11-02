#!/usr/bin/env bash
set -e

# One-command startup for Enterprise Workforce Analytics (Backend + Frontend)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "🛑 Stopping all services..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "=========================================="
echo " 🚀 Enterprise Workforce Analytics"
echo "=========================================="

# 0. Check and Start PostgreSQL Database if needed
echo "Checking PostgreSQL service..."
if ! nc -z localhost 5432 >/dev/null 2>&1; then
  echo "PostgreSQL is not responding on port 5432. Starting PostgreSQL..."
  brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
  for _ in {1..10}; do
    if nc -z localhost 5432 >/dev/null 2>&1; then
      echo "✅ PostgreSQL is now ready!"
      break
    fi
    sleep 0.5
  done
else
  echo "✅ PostgreSQL is running on port 5432."
fi

# 1. Start Backend API
echo "Starting Backend (FastAPI on :8000)..."
cd "$ROOT_DIR/backend"
if [ ! -x ".venv/bin/python" ]; then
  echo "Creating backend virtual environment..."
  python3 -m venv .venv
fi

if ! .venv/bin/python -c "import fastapi, sqlalchemy" >/dev/null 2>&1; then
  echo "Installing backend dependencies from backend/requirements.txt..."
  .venv/bin/python -m pip install -r requirements.txt
fi

.venv/bin/python -m uvicorn app.main:app --reload --port 8000 &

# Wait up to 10 seconds for this backend's health endpoint to respond
echo "Waiting for Backend to be ready on port 8000..."
READY=0
for i in {1..20}; do
  if curl --max-time 1 -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    READY=1
    echo "✅ Backend is ready!"
    break
  fi
  sleep 0.5
done

if [ $READY -eq 0 ]; then
  echo "⚠️  Backend startup took longer than 10s, proceeding anyway..."
fi

# 2. Start Frontend App
echo "Starting Frontend (Vite on :5173)..."
cd "$ROOT_DIR/frontend"
npm run dev &

echo ""
echo "✨ Both services are up and running!"
echo "   👉 Frontend: http://localhost:5173"
echo "   👉 Backend:  http://127.0.0.1:8000"
echo "   👉 Docs:     http://127.0.0.1:8000/docs"
echo ""
echo "Press [Ctrl + C] to stop all services."
echo "=========================================="

wait
