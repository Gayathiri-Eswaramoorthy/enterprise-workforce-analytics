FROM python:3.12-slim

WORKDIR /app

# Install backend Python dependencies first for better layer caching
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend app and the sibling ml package it imports at runtime
COPY backend backend
COPY ml ml

WORKDIR /app/backend

RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
