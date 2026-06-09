---
name: fastapi
description: >
  Patterns, scaffolding, and critical rules for FastAPI with Python 3.13+.
  Load when building FastAPI routes, middleware, dependencies, SSE streaming,
  rate limiting, or scaffolding a new project from scratch.
applyTo: "**"
---

# FastAPI — Skill

Complete reference for building FastAPI applications per HNRG standards.

---

## 1. Project scaffolding (new project from scratch)

### Prerequisites

- Python 3.13+ installed
- `uv` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Init

```bash
uv init .
echo "3.13" > .python-version

# Core
uv add "fastapi[standard]" sqlalchemy[asyncio] asyncpg alembic pydantic-settings structlog

# Auth (optional)
uv add PyJWT[crypto] pwdlib[bcrypt]

# Monitoring (optional)
uv add prometheus-fastapi-instrumentator slowapi

# Dev
uv add --dev pytest pytest-asyncio pytest-cov httpx ruff mypy pre-commit
```

### Directory structure

```
src/{package_name}/
  __init__.py
  __main__.py               # uvicorn.run entry point
  app.py                    # App factory with lifespan
  config/
    settings.py             # Pydantic Settings
    logging.py              # structlog setup
  api/
    deps.py                 # Shared dependencies (get_db, get_current_user)
    v1/
      router.py             # Aggregated v1 APIRouter
      health.py             # /health + /ready
      users.py              # domain routes
  core/                     # Pure business logic (no FastAPI imports)
  models/                   # SQLAlchemy models
    base.py                 # DeclarativeBase
  schemas/                  # Pydantic schemas (request/response)
  repositories/             # Data access layer
  services/                 # Service layer (orchestration)
  db/
    session.py              # AsyncEngine, async_session_factory
  errors/
    base.py                 # Custom exceptions
    handlers.py             # Exception → HTTPException mapping
  middleware/
    logging.py              # Correlation ID
tests/
  unit/
  integration/
  conftest.py               # app fixture, async client
alembic/
  env.py
  versions/
docker-compose.yml
pyproject.toml
```

### pyproject.toml essentials

```toml
[tool.ruff]
target-version = "py313"
line-length = 120

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "ANN", "B", "A", "SIM", "TCH", "RUF"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["ARG001"]

[tool.mypy]
python_version = "3.13"
strict = true
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-ra -q --strict-markers"
```

> `line-length` and `target-version` are **top-level** under `[tool.ruff]`, NOT inside `[tool.ruff.lint]`.

---

## 2. Core patterns

### App factory with lifespan

```python
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    yield
    await close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)
    app.include_router(api_v1_router, prefix="/api/v1")
    register_exception_handlers(app)
    return app
```

### Settings — pydantic-settings

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "my-api"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://app:changeme@localhost:5432/app"
    db_pool_size: int = 10
    cors_origins: list[str] = ["http://localhost:3000"]
```

**Test isolation**: `monkeypatch.delenv` is not enough — pydantic-settings reads `.env` directly:

```python
class TestSettings(Settings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
```

### Dependency injection with Depends()

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(user_repo=SQLAlchemyUserRepository(db))
```

### Pydantic schemas — separate Create/Update/Response

```python
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
```

---

## 3. Database — async SQLAlchemy

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    echo=settings.debug,
)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

Alembic setup:
```bash
uv run alembic init alembic
# Configure alembic/env.py → target_metadata = Base.metadata
uv run alembic upgrade head
```

---

## 4. Error handling

### Custom exceptions

```python
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str) -> None:
        super().__init__(f"{resource} {resource_id} not found", "NOT_FOUND", 404)
```

### Centralized exception handlers

```python
def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", path=request.url.path)
        return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}})
```

---

## 5. SSE streaming

### Via `astream_events` (LangGraph agents)

```python
async def _event_gen(agent, messages, config):
    async for event in agent.astream_events({"messages": messages}, config=config, version="v2"):
        kind = event.get("event")
        if kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"].content
            if chunk:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
    yield f"data: {json.dumps({'done': True})}\n\n"

@router.post("/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _event_gen(agent, messages, config),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

### Via `asyncio.Queue` (multi-phase pipelines)

```python
async def pipeline_sse(queue: asyncio.Queue):
    async def event_gen():
        while True:
            event = await queue.get()
            if event is None:  # sentinel — done
                yield f"data: {json.dumps({'done': True})}\n\n"
                break
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(event_gen(), media_type="text/event-stream")
```

---

## 6. Rate limiting with slowapi

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# In app factory
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In route — request: Request MUST be first parameter
@router.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    ...
```

---

## 7. Middleware

### Correlation ID

```python
class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
```

### Health checks

```python
@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@router.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
```

---

## 8. Webhook HMAC-SHA256 signing

```python
def sign_webhook(payload: dict, secret: str) -> str:
    body = json.dumps(payload, sort_keys=True).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={signature}"

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

- Always `sort_keys=True` for deterministic serialization
- Validate target URL with `SSRFValidator` before sending

---

## 9. Abstract connector pattern

```python
class AbstractConnector(ABC):
    @abstractmethod
    def get_items(self, **kwargs: object) -> list[dict]: ...

class MockConnector(AbstractConnector):
    def get_items(self, **kwargs: object) -> list[dict]:
        return [{"id": "1", "name": "Mock item"}]
```

ContextVar proxy for per-request switching (multi-tenant):

```python
_active_connector: ContextVar[AbstractConnector] = ContextVar("active_connector")

class _ConnectorProxy:
    def __getattr__(self, name: str) -> Any:  # must be Any, not object
        return getattr(_active_connector.get(), name)
```

---

## 10. Testing patterns

```python
@pytest.fixture
async def app():
    app = create_app()
    app.dependency_overrides[get_db] = get_test_db
    yield app
    app.dependency_overrides.clear()

@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
```

Mock async agent:

```python
mock_agent = MagicMock()
mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="answer")]})

with patch("mymodule.routes.build_agent", return_value=mock_agent):
    response = await client.post("/chat", json={"message": "test"})
```

Fixtures with `yield` must declare `Generator[YieldType, None, None]`, not the yield type directly.

---

## 11. Docker + deploy

```yaml
# docker-compose.yml
services:
  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
  db:
    image: postgres:17-alpine
    environment: { POSTGRES_DB: app, POSTGRES_USER: app, POSTGRES_PASSWORD: changeme }
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

- **Dev**: `fastapi dev src/{package_name}/app.py`
- **Prod**: `gunicorn {package_name}.app:create_app --factory -w 4 -k uvicorn.workers.UvicornWorker`
- **Migrations**: `alembic upgrade head` in CI/CD and container startup

---

## ⚠️ Critical Rules

### ContextVar in async handlers
- **Always `await agent.ainvoke()`** — sync `invoke()` does NOT propagate ContextVar to thread pool.

### LangChain 1.x / LangGraph
- `AgentExecutor` is removed — use `create_react_agent` from `langgraph.prebuilt` or agent-core templates.
- Agent invocation returns `{"messages": [...]}`. Last message = final response.

### ValueError / RuntimeError in exception handlers
- `ValueError` and `RuntimeError` → 400. Only plain `Exception` → 500.
- Tests expecting 500 must raise `Exception("msg")`, not `RuntimeError("msg")`.

### `datetime.UTC` (Python 3.11+)
- Use `datetime.UTC` instead of `timezone.utc` — ruff UP017 enforces this.

### HTTP status code migration (Starlette 0.40+)
- `HTTP_422_UNPROCESSABLE_ENTITY` → `HTTP_422_UNPROCESSABLE_CONTENT`.

### `__getattr__` proxy return type
- Must return `Any`, not `object`. Returning `object` causes mypy operator errors.

### Azure AI Foundry `max_tokens`
- Never use `max_tokens=1024` — tool schemas + system prompt exhaust the budget. Use `2048+`.

### setuptools build backend
- Use `build-backend = "setuptools.build_meta"` — NOT `setuptools.backends.legacy:build`.

### SQLite parameterized queries
- Always use `?` placeholders — never f-string interpolation.

---

## LLM-friendly documentation references

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
| httpx | — | `context7.com/encode/httpx/llms.txt` |
