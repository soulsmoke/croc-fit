---
applyTo: "**/*.py"
---

# Python Stack — Standard

## Supported Versions
- Python 3.12+ (recommended)
- Python 3.11 (minimum supported)

## Project Setup
- Use `uv` or `poetry` for dependency management
- Virtual environment required (`.venv/`)
- `pyproject.toml` as main configuration file

## Project Structure
```
src/
├── {package_name}/
│   ├── __init__.py
│   ├── api/              # Route/endpoint definitions
│   ├── core/             # Business logic
│   ├── models/           # Data models (Pydantic, SQLAlchemy)
│   ├── services/         # Service layer
│   └── utils/            # Utility functions
tests/
├── unit/
├── integration/
├── conftest.py
pyproject.toml
```

## Approved Dependencies
- Web Framework: FastAPI (API), Django (full-stack)
- ORM: SQLAlchemy 2.0 + Alembic
- Validation: Pydantic v2
- Testing: pytest + pytest-cov + pytest-asyncio
- Linting: Ruff (replaces flake8, isort, black)
- Type checking: mypy (strict mode)
- Task queue: Celery or ARQ

## Patterns
- Type hints everywhere (strict mypy compliance)
- Dependency injection with `Depends()` in FastAPI
- Pydantic models for I/O validation
- Context managers for resources (DB connections, file handles)
- async/await for I/O-bound operations

## Linting and Formatting
- Ruff for linting and formatting (`ruff check`, `ruff format`)
- mypy in strict mode
- pre-commit hooks configured

## Anti-patterns
- `import *` — always use explicit imports
- Mutable default arguments
- Bare `except:` — always specify the exception
- Mutable global state
- Ignoring type hints
