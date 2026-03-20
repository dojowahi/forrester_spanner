---
name: fastapi-nano
description: >
  Use this skill whenever the user wants to scaffold, build, extend, or work with a
  FastAPI project following the fastapi-nano blueprint pattern — a Flask-inspired
  divisional directory structure with uv for dependency management. Trigger on phrases
  like "create a FastAPI project", "add an API endpoint", "FastAPI blueprint structure",
  "fastapi-nano template", "set up FastAPI with uv", or any request to generate FastAPI
  boilerplate code. Also use when the user asks about running, testing, linting, or
  Dockerizing a FastAPI nano-style project.
---

# FastAPI Nano Skill

A guide for scaffolding and extending FastAPI projects using the **fastapi-nano** template
(https://github.com/rednafi/fastapi-nano) — a Flask-blueprint-inspired structure with
clean separation of concerns, OAuth2 auth, and `uv` for fast dependency management.

---

## Project Overview

| Component | Purpose |
|---|---|
| `svc/` | Primary service folder — all app code lives here |
| `svc/apis/<api_name>/` | One package per API feature (divisional structure) |
| `svc/routes/views.py` | Assembles and exposes all API endpoints |
| `svc/core/` | Shared config, auth, and utilities |
| `svc/tests/` | Integration and unit tests |
| `pyproject.toml` | Project metadata, deps, tool config (uv-compatible) |
| `uv.lock` | Pinned lockfile (commit this) |
| `docker-compose.yml` | Multi-container orchestration |
| `dockerfiles/` | Dockerfiles for multiple Python versions |
| `Caddyfile` | Reverse-proxy config |
| `makefile` | Dev shortcuts |

---

## Directory Structure

```
fastapi-nano/
├── svc/
│   ├── apis/
│   │   ├── api_a/
│   │   │   ├── __init__.py
│   │   │   ├── mainmod.py      # orchestrates sub-logic, called by routes
│   │   │   └── submod.py       # pure business logic
│   │   └── api_b/
│   │       ├── __init__.py
│   │       ├── mainmod.py
│   │       └── submod.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── auth.py             # OAuth2 + JWT (hashed passwords, Bearer tokens)
│   │   └── config.py           # pydantic-settings config (reads from .env)
│   ├── routes/
│   │   └── views.py            # all endpoint definitions; imports from apis/
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_api.py         # integration tests (HTTP response assertions)
│   │   └── test_functions.py   # unit tests (pure function assertions)
│   ├── __init__.py
│   └── main.py                 # FastAPI() app init, mounts router, CORS
├── dockerfiles/
│   ├── Dockerfile.py312
│   └── Dockerfile.py311
├── .env                        # environment variables (do NOT commit secrets)
├── .python-version             # e.g. 3.13
├── Caddyfile
├── docker-compose.yml
├── makefile
├── pyproject.toml
└── uv.lock
```

---

## Dependency Management with `uv`

This project uses [`uv`](https://docs.astral.sh/uv/) — a fast Rust-based Python package
manager that replaces pip, pip-tools, and virtualenv.

### Install uv

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip (not recommended for daily use)
pip install uv
```

### Common uv Commands

```bash
# Create a virtual environment with a specific Python version
uv venv --python 3.13

# Activate venv (Linux/macOS)
source .venv/bin/activate

# Install all dependencies from pyproject.toml
uv sync

# Add a new runtime dependency
uv add fastapi httpx

# Add a dev-only dependency
uv add --dev pytest ruff mypy

# Remove a dependency
uv remove some-package

# Update all dependencies and regenerate lock file
uv lock --upgrade

# Run a command inside the project environment without activating
uv run uvicorn svc.main:app --reload

# Show installed packages
uv pip list
```

### pyproject.toml (uv-compatible)

```toml
[project]
name = "fastapi-nano"
version = "0.1.0"
description = "FastAPI service"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "gunicorn>=22.0.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.9",
    "pydantic-settings>=2.3.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "ruff>=0.4.0",
    "mypy>=1.10.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "PT", "C4", "I"]
ignore = ["E501"]

[tool.mypy]
follow_imports = "skip"
ignore_missing_imports = true
warn_no_return = true
disallow_untyped_defs = true
no_implicit_optional = true
show_error_codes = true

[[tool.mypy.overrides]]
module = "svc.tests.*"
ignore_errors = true
```

---

## Code Patterns

### 1. Business Logic Module (`svc/apis/my_api/submod.py`)

Pure functions — no FastAPI imports, no HTTP concerns.

```python
from __future__ import annotations


def process_data(value: int) -> dict[str, int]:
    return {
        "input": value,
        "doubled": value * 2,
        "squared": value ** 2,
    }
```

### 2. Main Module (`svc/apis/my_api/mainmod.py`)

Orchestrates calls to submodules.

```python
from __future__ import annotations
from svc.apis.my_api.submod import process_data


def main_func(value: int) -> dict[str, int]:
    return process_data(value)
```

### 3. Route Definition (`svc/routes/views.py`)

All endpoints gathered here; uses `Depends` for auth.

```python
from __future__ import annotations
from fastapi import APIRouter, Depends
from svc.apis.api_a.mainmod import main_func_a
from svc.apis.api_b.mainmod import main_func_b
from svc.apis.my_api.mainmod import main_func
from svc.core.auth import get_current_user

router = APIRouter()


@router.get("/api_a/{num}", tags=["api_a"])
async def view_a(num: int, auth: str = Depends(get_current_user)) -> dict[str, int]:
    return main_func_a(num)


@router.get("/api_b/{num}", tags=["api_b"])
async def view_b(num: int, auth: str = Depends(get_current_user)) -> dict[str, int]:
    return main_func_b(num)


# Add new endpoints here following the same pattern
@router.get("/my_api/{value}", tags=["my_api"])
async def view_my_api(value: int, auth: str = Depends(get_current_user)) -> dict[str, int]:
    return main_func(value)
```

### 4. App Entry Point (`svc/main.py`)

```python
from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from svc.core.config import settings
from svc.routes.views import router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
```

### 5. Config (`svc/core/config.py`)

```python
from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "FastAPI Nano"
    APP_VERSION: str = "0.1.0"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALLOWED_HOSTS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
```

---

## Authentication (OAuth2 + JWT)

Default credentials in the template: **username:** `ubuntu`, **password:** `debian`.

The auth flow:
1. `POST /token` → exchange username/password for a JWT Bearer token
2. Protected endpoints use `Depends(get_current_user)` to validate the token

To customize, update `svc/core/auth.py` — the `fake_users_db` dict is a stand-in for a
real database lookup.

---

## Running the App

### Local (with uv)

```bash
# Install deps and start dev server
uv sync
uv run uvicorn svc.main:app --reload --port 5002

# Or use the makefile shortcut (sets up venv + runs uvicorn)
make run-local
```

### With Docker

```bash
# Build and start with docker-compose
make run-container

# Stop containers
make kill-container
```

The app serves at `http://localhost:5002`. Interactive docs: `http://localhost:5002/docs`.

---

## Testing & Linting

```bash
# Run tests
make tests
# Or directly:
uv run pytest svc/tests/ -v

# Lint with ruff
uv run ruff check svc/

# Type check with mypy
uv run mypy svc/

# All linting at once
make lint

# Update dependencies
make dep-update  # runs: uv lock --upgrade && uv sync
```

---

## Adding a New API

Follow these steps to add a new feature endpoint:

1. **Create the package:**
   ```
   svc/apis/my_feature/
   ├── __init__.py
   ├── mainmod.py
   └── submod.py
   ```

2. **Write business logic in `submod.py`** (pure functions, no FastAPI).

3. **Orchestrate in `mainmod.py`** (calls submod, applies transforms).

4. **Register the route in `svc/routes/views.py`:**
   ```python
   from svc.apis.my_feature.mainmod import main_func
   
   @router.get("/my_feature/{param}", tags=["my_feature"])
   async def view_my_feature(param: int, auth: str = Depends(get_current_user)) -> dict:
       return main_func(param)
   ```

5. **Write tests** in `svc/tests/test_functions.py` (unit) and `test_api.py` (integration).

---

## Docker Optimization Tips

- Uses `python:3.13-slim` as base — minimal image size
- `uv` speeds up installs significantly vs pip in CI/CD
- Multi-stage builds can be used to further reduce image size
- Dockerfiles for Python 3.11 and 3.12 live in `dockerfiles/`

---

## Key Design Principles

- **Divisional structure**: each API is a self-contained package (`apis/<name>/`)
- **Routes are thin**: `views.py` only wires URLs to `main_func` calls
- **Business logic is pure**: `submod.py` functions have no HTTP/framework imports
- **Single router**: all routes assembled in one `views.py` (split into multiple files for large projects)
- **12-factor config**: all env vars read via `.env` and `pydantic-settings`
- **uv for speed**: lockfile (`uv.lock`) committed; reproducible installs everywhere
