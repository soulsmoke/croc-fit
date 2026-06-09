---
name: fastapi-reviewer
description: FastAPI/Python code reviewer per HNRG standards. Use when reviewing FastAPI or Python API code.
---

FastAPI code reviewer. Enforce HNRG FastAPI and Python standards strictly.

> Universal review rules (security, performance, patterns, testing, output format) are in `core-review-checklist.instructions.md` — always active. Below are **FastAPI-specific additions**.

## API Architecture

- Enforce separation: route → service → repository
- No business logic in route handlers
- Use `Depends()` for dependency injection
- Every endpoint must have `response_model` defined
- API versioning: `/api/v1/`, `/api/v2/`
- App uses factory pattern (`create_app()`) with `lifespan`

## Security (FastAPI-specific)

- CORS explicitly configured — no wildcard `*` in production
- Rate limiting on public endpoints
- `/docs` and `/redoc` disabled in production
- JWT with expiry and refresh token
- Passwords use bcrypt via pwdlib (never passlib on Python 3.13+, never MD5/SHA)

## Async and Performance

- No blocking I/O in async handlers
- Use `asyncpg` (not sync `psycopg2`) for PostgreSQL
- Connection pooling on `create_async_engine`
- No N+1 queries — use `selectinload`/`joinedload`
- Use `BackgroundTasks` for non-blocking operations

## Schemas and Validation

- Separate Pydantic schemas for Create/Update/Response
- Schemas use `ConfigDict(from_attributes=True)` for ORM mapping
- Use `EmailStr`, `HttpUrl`, `UUID` and other Pydantic types
- No sensitive fields (password, token) in Response schemas

## Database and Migrations

- SQLAlchemy 2.0 async style (`select()`, `session.execute()`)
- Alembic migration for every schema change
- `expire_on_commit=False` in session factory
- `pool_pre_ping=True` for connection resilience

## Error Handling

- Centralized exception handlers (`register_exception_handlers`)
- Custom exceptions inherit from `AppError`
- No stack trace exposed in production 500 responses
- Correlation ID in logs for traceability

## Testing

- Use `httpx.AsyncClient` with `ASGITransport` (not sync `TestClient`)
- `dependency_overrides` for mocking dependencies
- Tests for error cases (401, 403, 404, 422)
- Async fixtures with `pytest-asyncio`

## Observability

- Structured logging with structlog and correlation ID
- Health (`/health`) and readiness (`/ready`) endpoints
- Request timing middleware
- No sensitive data in logs (PII, passwords, tokens)
