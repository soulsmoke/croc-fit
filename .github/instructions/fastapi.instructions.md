---
applyTo: "**/*.py"
---

# FastAPI Stack — Standard

## Supported Versions
- FastAPI 0.115+ (latest stable)
- Starlette 1.0+
- Uvicorn (latest stable)
- Python 3.13+

## ASGI Server
- Dev: `fastapi dev src/{package_name}/app.py` (auto-reload)
- Prod: `gunicorn {package_name}.app:create_app --factory -w 4 -k uvicorn.workers.UvicornWorker`

## Project Structure
```
src/{package_name}/
  __init__.py
  __main__.py           # uvicorn.run entry point
  app.py                # App factory with lifespan
  config/settings.py    # Pydantic Settings
  api/
    deps.py             # Shared dependencies
    v1/router.py        # Aggregated v1 APIRouter
  core/                 # Pure business logic (no FastAPI imports)
  models/               # SQLAlchemy models
  schemas/              # Pydantic schemas (request/response)
  repositories/         # Data access layer
  services/             # Orchestration
  db/session.py         # AsyncEngine + session factory
  errors/base.py        # Custom exceptions
  errors/handlers.py    # Exception → HTTP mapping
  middleware/           # Correlation ID, timing
tests/
  unit/ integration/ conftest.py
alembic/
docker-compose.yml
pyproject.toml
```

## Approved Dependencies
- **Framework**: `fastapi[standard]`
- **DB**: SQLAlchemy 2.0 (async) + asyncpg + Alembic
- **Validation**: Pydantic v2
- **Auth**: PyJWT or joserfc, pwdlib[bcrypt]
- **Testing**: pytest + pytest-asyncio + httpx
- **Logging**: structlog
- **HTTP Client**: httpx
- **Rate Limiting**: slowapi
- **Monitoring**: prometheus-fastapi-instrumentator

## Do
- Use app factory pattern with `lifespan` context manager
- Separate schemas: `Create`, `Update`, `Response`
- Versioned routes: `/api/v1/`, `/api/v2/`
- `Depends()` for DI — separate module `api/deps.py`
- `pydantic-settings` for all configuration
- Health checks: `GET /health` (liveness) + `GET /ready` (readiness)
- Async SQLAlchemy with `pool_pre_ping=True`
- `structlog` with JSON renderer in production
- `httpx` as production dependency if calling external APIs

## Don't
- `allow_origins=["*"]` in production CORS
- `/docs` or `/redoc` in production
- `passlib` on Python 3.13+ (use `pwdlib`)
- `AgentExecutor` (removed in LangChain 1.x — use LangGraph)
- `build-backend = "setuptools.backends.legacy:build"`
- `timezone.utc` (use `datetime.UTC` — ruff UP017)
- Sync `agent.invoke()` from async handlers (ContextVar won't propagate)
- `max_tokens=1024` on Azure AI Foundry (use 2048+)

## Security
- CORS: explicit origins only
- Rate limiting on public endpoints (slowapi)
- Input validation via Pydantic (never trust input)
- JWT with short expiry + refresh token
- Password hashing: `pwdlib[bcrypt]`
- Security headers via middleware
- SSRF validation for webhook URLs

## Documentation References

| Technology | Official `llms.txt` | Fallback (Context7) |
|---|---|---|
| FastAPI | — | `context7.com/fastapi/fastapi/llms.txt` |
| Pydantic | `docs.pydantic.dev/latest/llms.txt` | `context7.com/pydantic/pydantic/llms.txt` |
| SQLAlchemy | — | `context7.com/sqlalchemy/sqlalchemy/llms.txt` |
| Alembic | — | `context7.com/sqlalchemy/alembic/llms.txt` |
| uv | `docs.astral.sh/uv/llms.txt` | — |
| Ruff | `docs.astral.sh/ruff/llms.txt` | — |
| pytest | — | `context7.com/pytest-dev/pytest/llms.txt` |
| structlog | — | `context7.com/hynek/structlog/llms.txt` |

> **Nota**: Per Pydantic è disponibile anche `llms-full.txt` per la documentazione API completa.
> Per i siti Astral puoi fetchare pagine markdown con `/index.md` (es. `https://docs.astral.sh/uv/guides/integration/fastapi/index.md`).

## Anti-pattern da Evitare
- `@app.on_event("startup")` / `@app.on_event("shutdown")` — usa `lifespan` context manager
- `response_model` con modello ORM diretto — usa sempre uno schema Pydantic dedicato
- Business logic nei route handler — muovila nel service layer
- `Depends()` con side effects non gestiti — usa sempre try/yield/except
- Sync database driver in app async — usa `asyncpg`/`aiosqlite`, mai `psycopg2` sync
- Test con `TestClient` sync — usa `httpx.AsyncClient` con `ASGITransport`
- `allow_origins=["*"]` in produzione — elenca esplicitamente i domini
- Secrets in query parameters — usa headers o body
- Missing `response_model` — definiscilo sempre per type safety e docs automatiche
