---
name: docker
description: >
  Guidelines for building optimized, multi-stage Dockerfiles for Python and Node.js
  monorepos, specifically focusing on speed-ups using Astral's `uv` package manager and 
  avoiding dependency resolution locks in container setups using `--frozen` locks.
---

# Docker Configuration for Monorepos with `uv`

A guide for crafting Dockerfiles that build hybrid React/Vite frontends and FastAPI/Python backends efficiently using multi-stage setups and `uv` for lightning-fast installs.

---

## 💡 Best Practices & Learnings

### 1. ❄️ The `--frozen` Flag with `uv`
By default, running `uv sync` inside standard CI/CD or Dockerfiles should use `--frozen` to enforce that dependencies match exactly what was resolved locally.

*   **The Problem:** If `uv.lock` was generated in a workspace environment that forces custom artifact registries or mirrors (e.g., corporate artifactory tiers), the lock file will embed absolute URL links to that registry. Inside a clean Docker container build with no credential helpers, this triggers a **401 Unauthorized** error.
*   **The Solution for Public Projects:** If your project only uses standard public packages (e.g., listed in `pyproject.toml`), **omit `uv.lock` from the `COPY` instruction** and **remove the `--frozen` flag** from `uv sync`. This forces the RAW `uv` binary inside the container to re-resolve dependencies from the default public PyPi indexes without authenticating.

```dockerfile
# ✅ Correct implementation for index isolation without private-locked URLs
COPY backend/pyproject.toml ./backend/
RUN cd backend && uv sync --config-file=/dev/null --no-dev --no-editable
```

---

### 2. 🛡️ Overriding Host configuration (`--config-file=/dev/null`)
When building inside environments that might have pre-configured system-wide or user-level configuration files (like `/etc/uv/uv.toml` or `~/.config/uv/uv.toml`), `uv` will respect those settings during a resolve or sync phase.

*   **The Problem:** On shared workstations or corporate build servers, a global config can force `uv` to resolve dependencies from corporate mirrors or authentication-gated Artifactory layers, causing a standard `uv lock` or `uv sync` from a clean workspace to embed internal URLs into `uv.lock`.
*   **The Solution:** Use `--config-file=/dev/null` with `uv lock` or `uv sync` to force `uv` to ignore all system/global configuration bundles and use standard internet indexing paths for pure isolation. However, if the URLs are already locked in `uv.lock`, you must combine this with omitting the lock file described above.


---

### 3. 🧊 Layer Caching Layouts
Dependency installs take seconds; copying source takes milliseconds. Separate these layers strictly so you don't invalidate heavy dependency trees on single-line code changes.

1.  **Copy metadata first:** `package.json`, `package-lock.json`, `pyproject.toml`, `uv.lock`
2.  **Install tools:** `npm ci`, `uv sync`
3.  **Copy source code next:** `COPY frontend/ .`, `COPY backend/svc .`

---

### 3. 🎭 Multi-stage Builds for Monorepos
Never bundle Node.js or builder toolchains inside your production runner. 

| Stage | Goal | Recommended Image |
|---|---|---|
| **`frontend-builder`** | Transpile TypeScript/React into statically served HTML/JS assets. | `node:20-alpine` |
| **`backend-builder`** | Resolve Python `.venv` structures and load wheel caches. | `ghcr.io/astral-sh/uv:python3.13-bookworm-slim` |
| **`Runner`** | Simple Python runtime container that copies artifacts (Frontend static + Backend `.venv`) upwards. | `python:3.13-slim` |

---

## 📄 Reference Template

```dockerfile
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

# Copy ONLY metadata to trigger cached layers if lock hasn't changed
COPY backend/pyproject.toml backend/uv.lock ./backend/
RUN cd backend && uv sync --config-file=/dev/null --frozen --no-dev --no-editable

# --- Stage 3: Slim Production Runner ---
FROM python:3.13-slim-bookworm
WORKDIR /app

# 1. Take virtualenv from builder
COPY --from=backend-builder /app/backend/.venv /app/backend/.venv
ENV PATH="/app/backend/.venv/bin:$PATH"

# 2. Take compiled frontend into expected static stream
COPY --from=frontend-builder /app/frontend/dist /app/backend/static

# 3. Pull Backend logics
COPY backend/svc /app/backend/svc

EXPOSE 8080
WORKDIR /app/backend
CMD ["uvicorn", "svc.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## 🚨 Gotchas to Avoid

*   **Avoid `--no-cache` inside Docker:** Building with `uv` is already fast; trying to flush disk-level layers defeats the purpose of caching inside iterative stages using volume builds.
*   **Keep `.env` files out:** Do not embed credentials or `.env` files inside Docker context unless they are purely boilerplate setup. Use environment variables defined natively by orchestrators (Cloud Run, K8s).
*   **Use `.dockerignore`:** Exclude large folders like `node_modules`, `.venv`, and `__pycache__` from entering the building context before copy frames.
