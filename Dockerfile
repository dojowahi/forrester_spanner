# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend with uv ---
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS backend-builder
WORKDIR /app

# The lock files are in the root directory, so copy metadata
COPY pyproject.toml ./
# Sync using pure PyPi index (ignoring private network uv.lock)
RUN uv sync --config-file=/dev/null --no-dev --no-editable

# --- Stage 3: Slim Production Runner ---
FROM python:3.13-slim-bookworm
WORKDIR /app

# 1. Take virtualenv from builder
COPY --from=backend-builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# 2. Take compiled frontend into expected static stream
COPY --from=frontend-builder /app/frontend/dist /app/static

# 3. Pull Backend logics
COPY backend /app/backend
COPY main.py /app/main.py

EXPOSE 8080
CMD uvicorn backend.svc.main:app --host 0.0.0.0 --port ${PORT:-8080}
