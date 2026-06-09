---
name: python-project-setup
description: Initialize a new Python project per HNRG standards using uv. Use when creating a new Python library, CLI, or generic module from scratch.
applyTo: "**"
---

## Goal

Create a new Python project (library, CLI, or generic app) following HNRG standards.

## Prerequisites

- Python 3.13+ installed
- `uv` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

## Steps

### 1. Initialize

Already in project root. Initialize in-place:

```bash
uv init --lib .    # for library
# or
uv init .          # for app / CLI
echo "3.13" > .python-version
```

Create `.gitignore`:

```
.venv/
__pycache__/
*.pyc
dist/
*.egg-info/
.mypy_cache/
.ruff_cache/
.pytest_cache/
.coverage
htmlcov/
.env
.env.local
```

### 2. Configure pyproject.toml

```toml
[project]
name = "{project_name}"
version = "0.1.0"
description = ""
readme = "README.md"
requires-python = ">=3.13"
dependencies = []

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.25",
    "pytest-cov>=5.0",
    "ruff>=0.8",
    "mypy>=1.13",
    "pre-commit>=4.0",
    "structlog>=24.0",
    "pydantic-settings>=2.0",
]

# Only for CLI — uncomment if needed:
# [project.scripts]
# {project_name} = "{package_name}.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py313"
line-length = 120

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "ANN", "B", "A", "SIM", "TCH", "RUF"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["ARG001"]

[tool.ruff.lint.isort]
known-first-party = ["{package_name}"]

[tool.mypy]
python_version = "3.13"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-ra -q --strict-markers"
```

### 3. Directory Structure

```bash
mkdir -p src/{package_name}/{config,core,models,errors,utils}
mkdir -p tests/{unit,integration,fixtures}
find src/{package_name} -type d -exec touch {}/__init__.py \;
touch tests/__init__.py tests/conftest.py
```

### 4. Settings — `src/{package_name}/config/settings.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "{project_name}"
    debug: bool = False
    log_level: str = "INFO"

settings = Settings()
```

### 5. Custom Errors — `src/{package_name}/errors/base.py`

```python
class AppError(Exception):
    def __init__(self, message: str, code: str) -> None:
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str) -> None:
        super().__init__(f"{resource} {resource_id} not found", "NOT_FOUND")

class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, "VALIDATION_ERROR")
```

### 6. Structured Logging — `src/{package_name}/config/logging.py`

```bash
uv add structlog
```

```python
import logging
import structlog

def setup_logging(log_level: str = "INFO", json_output: bool = False) -> None:
    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
    ]
    if json_output:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper(), logging.INFO),
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
```

### 7. Pre-commit Hooks — `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]
```

### 8. Docker (optional) — `Dockerfile`

```dockerfile
FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

FROM base AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable
COPY src/ ./src/

FROM base AS runtime
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "{package_name}"]
```

`.dockerignore`:

```
.venv
__pycache__
*.pyc
.git
.mypy_cache
.ruff_cache
.pytest_cache
.coverage
htmlcov
*.egg-info
```

### 9. Install

```bash
uv sync
uv run pre-commit install
```

## ⚠️ Critical Rules

### setuptools build backend

- **Do NOT use** `build-backend = "setuptools.backends.legacy:build"` — fails with `BackendUnavailable`.
- Use `build-backend = "setuptools.build_meta"` or `hatchling.build` (preferred).

### ruff.toml / pyproject.toml ruff section

- `line-length` and `target-version` are **top-level** under `[tool.ruff]`, NOT inside `[tool.ruff.lint]`.
- Per-file ignores: `[tool.ruff.lint.per-file-ignores]` — separate section.
- Pytest fixture parameters trigger `ARG001` — suppress with `"tests/**" = ["ARG001"]`.

### Generator return type for pytest fixtures with yield

- Fixtures using `yield` must declare return type as `Generator[YieldType, None, None]`, not the yield type directly.
- Import from `collections.abc`: `from collections.abc import Generator`.

### `datetime.UTC` (Python 3.11+)

- Use `datetime.UTC` instead of `timezone.utc` — ruff UP017 enforces this.
- Pattern: `datetime.now(tz=datetime.UTC)`.

### pydantic-settings env isolation in tests

- `monkeypatch.delenv` is not enough — pydantic-settings reads `.env` file directly, ignoring removed env vars.
- Fix: subclass `Settings` in tests with `model_config = SettingsConfigDict(env_file=None)`.

## Commands

```bash
# Lint
uv run ruff check .
uv run ruff check . --fix

# Type check
uv run mypy src/ --strict

# Tests
uv run pytest tests/ -v

# Tests with coverage
uv run pytest tests/ -v --cov=src/{package_name}

# Build check (library)
uv run python -c "import {package_name}; print('OK')"
```

## Expected Output

A Python project ready for development with:
- `uv` as package manager
- Complete `pyproject.toml`
- Ruff for linting and formatting
- mypy in strict mode
- pytest with asyncio support
- structlog for structured logging
- Pydantic Settings for configuration
- Docker ready (optional)
- Pre-commit hooks configured
