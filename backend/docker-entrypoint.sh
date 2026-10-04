#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
python - <<'PYEOF'
import sys
import time

from app.database.session import verify_db_connection

for attempt in range(30):
    if verify_db_connection():
        sys.exit(0)
    time.sleep(2)

print("[entrypoint] Database never became ready.", file=sys.stderr)
sys.exit(1)
PYEOF

echo "[entrypoint] Running database migrations..."
alembic upgrade head

if [ ! -f "../ml/artifacts/workforce_risk_model.joblib" ]; then
  echo "[entrypoint] No trained model artifact found - running ML training pipeline..."
  python ../ml/training/train.py
fi

echo "[entrypoint] Checking whether demo data needs seeding..."
python - <<'PYEOF'
from app.database.session import SessionLocal
from app.database.seed import seed_database
from app.models import User

db = SessionLocal()
try:
    has_data = db.query(User).first() is not None
finally:
    db.close()

if has_data:
    print("[entrypoint] Existing data found - skipping seed (would reset demo records).")
else:
    seed_database()
PYEOF

echo "[entrypoint] Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
