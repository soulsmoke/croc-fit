---
name: agent-core
description: >
  Load when building a new AI agent vertical that uses agent-core as a dependency.
  Covers installation, settings, tool registration, templates, wiring, and testing patterns.
applyTo: "**"
---

# agent-core — Vertical Development Skill

Python framework for multi-domain AI agents. Distributed via GitHub Releases.

---

## 0. Build a vertical from 0 — complete checklist

Follow this checklist in order. Every step must pass before the next.

```
[ ] 1. Create project structure (see "Vertical project structure" below)
[ ] 2. Install agent-core (see "Installation" below)
[ ] 3. Create .env.example + .env.local
[ ] 4. Create settings.py extending BaseAgentSettings
[ ] 5. Register tools with @register_tool
[ ] 6. Choose a template (GenericTemplate / SalesCRMTemplate / FashionTemplate / DevAssistantTemplate / custom)
[ ] 7. Wire main.py — local build_agent() wrapper  ← returns (bundle, template) tuple
[ ] 8. ⚠️  Create server.py — FastAPI entry point (MANDATORY if deploying or using agent-ui;
        for throwaway local prototyping only you may skip and use agent-core-serve temporarily)
[ ] 9. Create tests/helpers.py + test_tools.py + test_agent.py
[ ] 10. Verify: python -c "from my_vertical.main import build_agent; build_agent()"
[ ] 11. Run: python -m my_vertical.server (FastAPI) OR python -m my_vertical.main (CLI REPL)
        (requires my_vertical/__main__.py — see section 7)
[ ] 12. (Optional) Connect agent-ui frontend — load skill: .github/skills/agent-ui/SKILL.md
        Set apiUrl in agent-ui.config.json → "http://localhost:8000" (default server port)
```

> **When server.py is mandatory**: required if the vertical will be deployed or used with `agent-ui`.
> Without `server.py` the vertical has no HTTP entry point.
> For throwaway local prototyping only, you may temporarily skip step 8 and use `agent-core-serve` instead (see section 7) — not suitable for production.

### Minimal vertical — complete working example (copy-paste)

```python
# settings.py
from agent_core import BaseAgentSettings

class MySettings(BaseAgentSettings):
    pass


# tools/items.py
from agent_core import register_tool

@register_tool(group="read", description="List all items.")
async def list_items() -> list[dict]:
    return [{"id": "1", "name": "Widget"}]

@register_tool(group="write", description="Create an item with the given name.")
async def create_item(name: str) -> dict:
    return {"id": "new-1", "name": name}


# main.py
from langgraph.checkpoint.memory import MemorySaver
from agent_core import GenericTemplate
from my_vertical.settings import MySettings
from my_vertical.tools.items import list_items, create_item

_TOOLS = [list_items, create_item]

def build_agent(settings=None, *, with_memory=True):
    cfg = settings or MySettings()
    checkpointer = MemorySaver() if with_memory else None
    template = GenericTemplate(settings=cfg)
    bundle = template.build(
        extra_tools=_TOOLS,
        checkpointer=checkpointer,
    )
    return bundle, template


# Invoke:
import asyncio

async def main():
    bundle, _ = build_agent()
    config = {"configurable": {"thread_id": "demo:session-1"}}
    result = await bundle.graph.ainvoke(
        {"messages": [{"role": "user", "content": "List all items"}]},
        config=config,
    )
    print(result["messages"][-1].content)

asyncio.run(main())
```

**Verify it works before adding complexity.**

---

## Installation

Before installing, check the latest release tag at: https://github.com/HNRG-Lab/agent-core/releases

```bash
pip install git+https://github.com/HNRG-Lab/agent-core.git@<latest-tag>
```

Add to `pyproject.toml` (replace `<latest-tag>` with the current latest tag, e.g. `v1.3.0`):

```toml
[project]
dependencies = [
    "agent-core @ git+https://github.com/HNRG-Lab/agent-core.git@<latest-tag>",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5.0",
    "ruff>=0.4",
    "mypy>=1.10",
]
```

---

## Vertical project structure

```
my-vertical/
  settings.py              # Extend BaseAgentSettings
  tools/
    __init__.py
    <domain>.py            # @register_tool decorated functions
  connectors/
    __init__.py
    <service>.py           # Extend AbstractConnector (optional)
  main.py                  # build_agent() wiring
  tests/
    test_tools.py
    test_agent.py
  pyproject.toml
  .env.local               # Local secrets — never commit
  .env.example             # Variable names only — commit
```

---

## 1. Settings — extend BaseAgentSettings

```python
from pydantic import Field
from agent_core import BaseAgentSettings

class MySettings(BaseAgentSettings):
    """Domain-specific configuration."""
    service_api_key: str = Field(default="")
    max_results: int = Field(default=10)
```

**Rules:**
- Never hardcode secrets — always via `Field(default="")` + `.env.local`
- `BaseAgentSettings` loads from `.env.local` automatically (pydantic-settings)
- In tests: subclass with `model_config = SettingsConfigDict(env_file=None)` to avoid reading `.env.local`

```python
# Test isolation pattern — MANDATORY
from pydantic_settings import SettingsConfigDict
from agent_core import BaseAgentSettings

class _IsolatedSettings(MySettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
```

---

## 2. Tools — @register_tool decorator

```python
from agent_core import register_tool

@register_tool(
    group="read",                          # "read" | "write" | "advisor" | "enrichment"
    description="Get a contact by ID.",   # shown to LLM — be precise
    aliases={"contact_id": ["id", "contactId"]},  # optional — maps LLM param variants
)
async def get_contact(contact_id: str) -> dict[str, str]:
    """Return contact details."""
    return {"id": contact_id, "name": "Alice"}
```

**Rules:**
- Always `async def` — sync tools block the event loop
- `@register_tool` preserves `inspect.iscoroutinefunction()` for async functions (BUG-001 fix, v1.6.0+)
- Return type must be serialisable (dict, list, str, int, bool)
- `group="write"` tools require explicit user confirmation in default rules
- `aliases` resolves LLM hallucinated param names (e.g. `contactId` → `contact_id`)
- Duplicate tool name raises `ValueError` — use autouse fixture `clear_registry()` in tests

```python
# Test fixture — MANDATORY in every test file that imports tools
from agent_core import clear_registry  # also available as: from agent_core.tools import clear_registry

@pytest.fixture(autouse=True)
def _clean_registry():
    clear_registry()
    yield
    clear_registry()
```

---

## 3. Templates — use built-in or subclass

### Built-in templates (ready to use)

| Template | Entity categories | Use for |
|---|---|---|
| `GenericTemplate` | none | Any domain — neutral starting point |
| `SalesCRMTemplate` | contact, deal, activity | CRM / sales agents |
| `FashionTemplate` | product, order, look | Fashion / retail agents |
| `DevAssistantTemplate` | pr, issue, pipeline | Dev tooling agents |

Import: `from agent_core import GenericTemplate, SalesCRMTemplate, FashionTemplate, DevAssistantTemplate`

```python
from agent_core import SalesCRMTemplate, BaseAgentSettings

settings = MySettings()
template = SalesCRMTemplate(settings=settings)
bundle = template.build(
    extra_tools=[get_contact, create_deal],   # your domain tools
    checkpointer=MemorySaver(),               # optional — for conversation memory
    extra_rules=["Max 10 contacts per search."],
    entity_context="",                        # pre-populated entity summary
    user_name="Alice",                        # optional — sanitized before prompt injection
)
```

`user_name` is automatically sanitized via `PromptSanitizer` before being injected into the system prompt. Pass the JWT `name` claim here to personalize the agent response safely.

### Custom template (new domain)

```python
from agent_core.templates import AgentTemplate
from agent_core.tracking.entity_tracker import ToolCategoryMapping

class MyDomainTemplate(AgentTemplate):
    def role(self) -> str:
        return "a MyDomain Assistant"

    def entity_mapping(self) -> ToolCategoryMapping:
        return {
            "get_item": ("item", "name"),
            "list_items": ("item", "name"),
        }

    def write_tool_names(self) -> set[str]:
        return {"create_item", "update_item", "delete_item"}

    def default_rules(self) -> list[str]:
        return [
            "Never create items without user confirmation.",
        ]
```

---

## 4. Wiring — main.py (minimal pattern)

```python
from langgraph.checkpoint.memory import MemorySaver
from agent_core import SalesCRMTemplate
from agent_core.tools import clear_registry

from my_vertical.settings import MySettings
from my_vertical.tools.items import get_item, create_item

_ALL_TOOLS = [get_item, create_item]

def build_agent(settings=None, *, with_memory=True):
    cfg = settings or MySettings()
    template = SalesCRMTemplate(settings=cfg)
    checkpointer = MemorySaver() if with_memory else None
    bundle = template.build(
        extra_tools=_ALL_TOOLS,
        checkpointer=checkpointer,
    )
    return bundle, template
```

**Invoke the agent:**

```python
bundle, template = build_agent()   # unpack — build_agent returns (bundle, template)
config = {"configurable": {"thread_id": "tenant1:session1"}}
result = await bundle.graph.ainvoke(
    {"messages": [{"role": "user", "content": "List all items"}]},
    config=config,
)
last_message = result["messages"][-1].content
```

### AgentBundle — full API reference

`template.build()` returns an `AgentBundle`. All fields:

```python
@dataclass
class AgentBundle:
    graph: CompiledStateGraph        # LangGraph graph — ainvoke, astream_events
    settings: BaseAgentSettings      # settings passed at build time
    callbacks: list[Any]             # [HallucinationGuard] + extra_callbacks
    recursion_limit: int             # = settings.agent_recursion_limit (default 12)
    input_validator: InputValidator  # call .validate(msg) for manual pre-validation
    prompt_sanitizer: PromptSanitizer  # call .sanitize_display_name(name) for free-form fields

    def trim_history(self, messages: list[BaseMessage]) -> list[BaseMessage]:
        # Slides to last N turns (settings.agent_history_window, default 20)
        ...
```

Usage patterns:

```python
bundle, _ = build_agent()

# Pass recursion_limit from bundle — already read from settings
config = {
    "configurable": {"thread_id": "tenant:session"},
    "recursion_limit": bundle.recursion_limit,   # for deep tool chains
}

# Trim history before re-injection in multi-turn loops
trimmed = bundle.trim_history(messages)

# Pass callbacks if using config-based LangGraph callbacks
config["callbacks"] = bundle.callbacks
```

---

## 5. EntityTracker — update context after tool calls

```python
bundle, template = build_agent()

# After a tool call returns data, update the tracker:
template.tracker.update_from_tool_output("get_contact", {"id": "c1", "name": "Alice"})

# Get context string to re-inject into next prompt:
ctx = template.tracker.build_context_string()
# → "Contacts: Alice (c1)"

# Get all known IDs (for hallucination guard seeding):
known_ids = template.tracker.get_all_ids()
```

---

## 6. Storage backends

`StorageBackend` = entity/history persistence (custom state).  
`create_checkpointer` = LangGraph conversation state (messages). They are separate layers.

```python
from agent_core import MemoryStorageBackend, SQLiteStorageBackend, PostgresStorageBackend

# Entity/history persistence
store = MemoryStorageBackend()                                    # in-memory
store = SQLiteStorageBackend("sqlite:///./agent.db")               # file-based
store = PostgresStorageBackend("postgresql://user:pass@host/db")  # multi-process
await store.initialize()   # postgres only — creates pool + table
```

### LangGraph checkpointer bridge

`STORAGE_BACKEND` maps to the right LangGraph checkpointer automatically:

```python
from agent_core.history import create_checkpointer

async with create_checkpointer(settings) as checkpointer:
    bundle = SalesCRMTemplate(settings=settings).build(
        extra_tools=mcp_tools,
        checkpointer=checkpointer,
    )
    # bundle is valid only within this block
```

Mapping:
- `STORAGE_BACKEND=memory`   → `MemorySaver` (in-process, non-persistent)
- `STORAGE_BACKEND=sqlite`   → `AsyncSqliteSaver` (strips `sqlite:///` prefix automatically)
- `STORAGE_BACKEND=postgres` → `AsyncPostgresSaver` (calls `setup()` to create tables)

---

## 7. FastAPI + SSE — `create_agent_app` (recommended)

Use `create_agent_app` for the fastest path to production. Includes SecurityHeadersMiddleware + rate limiting + `/chat` SSE + `/health`.

### Canonical server.py (copy-paste template — MANDATORY for every vertical)

Create `my_vertical/server.py`. **Every vertical that exposes an HTTP endpoint must have this file.**

```python
"""HTTP server entry point — wraps <vertical> as a FastAPI + SSE service."""

from __future__ import annotations

import asyncio
import logging
import os

import uvicorn
from agent_core.api import create_agent_app

from my_vertical.main import build_agent
from my_vertical.settings import MySettings

logger = logging.getLogger(__name__)


async def main() -> None:
    settings = MySettings()
    bundle, _ = build_agent(settings)

    # Extra CORS origins from env (comma-separated).
    # Local-dev origins (Expo, Vite, Next.js …) are added automatically by
    # agent-core when APP_ENV=local — no manual list needed here.
    extra_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

    app = create_agent_app(
        bundle,
        settings,
        cors_origins=extra_origins or None,
    )

    port = int(os.environ.get("SERVER_PORT", "8000"))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)

    logger.info("[server] Starting on http://0.0.0.0:%d", port)
    await server.serve()


def serve() -> None:
    """Sync entry point — ``python -m my_vertical.server``."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
        raise SystemExit(0) from None


if __name__ == "__main__":
    serve()
```

> **CORS** is handled automatically by agent-core when `APP_ENV=local` — no explicit CORS config needed for local dev (Expo 8081, Vite 5173, Next.js 3000, Angular 4200, etc.).

Run the server:
```bash
python -m my_vertical.server
SERVER_PORT=8001 python -m my_vertical.server
```

> **`__main__.py`**: to enable `python -m my_vertical.server`, create `my_vertical/__main__.py`:
> ```python
> from my_vertical.server import serve
> serve()
> ```

### agent-core-serve — zero-config fallback (prototyping only)

`agent-core` ships a generic server command that requires **no custom `server.py`**. For **prototyping and local testing only** — before the vertical has a custom `server.py`.

```bash
# No tools (bare GenericTemplate)
agent-core-serve

# Load vertical's tools via module import
AGENT_MODULE=my_vertical.tools agent-core-serve

# Custom port
SERVER_PORT=8001 agent-core-serve
```

Limitations vs custom `server.py`:
- Uses `GenericTemplate` — no custom system prompt or entity mapping
- Uses `MemorySaver` — no persistent history
- Cannot load MCP tools (no async init phase)
- Not suitable for production — use a custom `server.py` instead

### Mount on existing app (custom setup)

```python
from agent_core.api import create_agent_router
from agent_core.auth import JWTValidator

# Minimal — no auth, default thread_id
router = create_agent_router(bundle, settings, prefix="/v1")

# With JWT auth — adds Bearer validation as FastAPI Depends on /chat
validator = JWTValidator(
    jwks_url="https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
    audience="api://my-app",
    issuer="https://sts.windows.net/{tenant}/",
)
router = create_agent_router(bundle, settings, auth_provider=validator)

# With custom thread_id logic (e.g. derived from JWT claims)
router = create_agent_router(
    bundle,
    settings,
    auth_provider=validator,
    thread_id_factory=lambda request: f"tenant:{request.state.claims.subject}",
)

existing_app.include_router(router)
```

`create_agent_router` full signature:

```python
def create_agent_router(
    bundle: AgentBundle,
    settings: BaseAgentSettings,
    *,
    prefix: str = "",
    auth_provider: AbstractAuthProvider | None = None,   # adds Depends() on /chat
    thread_id_factory: Callable[[Request], str] | None = None,  # custom thread_id
) -> APIRouter: ...
```

Request body:
```json
{"message": "hello", "thread_id": "tenant-id:session-42"}
```

`thread_id` omitted → defaults to `"{settings.tenant_id}:default"` (or `thread_id_factory(request)` if set).

---

## 8. Auth — JWT validation

```python
from agent_core import JWTValidator

# JWKS (Azure AD, Auth0, Entra ID)
validator = JWTValidator(
    jwks_url="https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
    audience="api://my-app",
    issuer="https://sts.windows.net/{tenant}/",
)

claims = await validator.validate(token)
# claims.subject, claims.tenant_id, claims.roles
```

---

## 9. Environment variables

Mandatory `.env.local` (never commit):

```bash
APP_NAME=my-vertical
APP_ENV=local
LLM_PROVIDER=ollama         # ollama | azure_foundry | litellm
OLLAMA_MODEL=qwen3:8b
STORAGE_BACKEND=sqlite
DATABASE_URL=sqlite:///./agent.db
```

For production:

```bash
LLM_PROVIDER=azure_foundry
AZURE_FOUNDRY_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1
AZURE_FOUNDRY_API_KEY=<key>
AZURE_FOUNDRY_MODEL=gpt-4o
STORAGE_BACKEND=postgres
DATABASE_URL=postgresql://user:pass@host/db
```

---

## 10. Testing patterns

**`tests/helpers.py`** — define shared helpers once, never repeat across test files:

```python
# tests/helpers.py
from pydantic_settings import SettingsConfigDict
from my_vertical.settings import MySettings

class _IsolatedSettings(MySettings):
    """Never reads .env.local — prevents test environment contamination."""
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
```

Import in each test file (requires `tests/__init__.py` to exist):

```python
from tests.helpers import _IsolatedSettings
```

**Stub LLM and build_agent test:**

```python
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage
from agent_core.agent import AgentBundle

def _make_stub_llm(reply: str = "OK") -> Any:
    """Stub LLM for tests — does NOT actually call any LLM."""
    llm = MagicMock()
    ai_msg = AIMessage(content=reply)
    llm.ainvoke = AsyncMock(return_value=ai_msg)
    llm.invoke = MagicMock(return_value=ai_msg)
    llm.bind_tools = MagicMock(return_value=llm)
    llm.astream_events = AsyncMock(return_value=iter([]))
    return llm

def test_build_agent():
    stub = _make_stub_llm()
    with patch("agent_core.templates.base.create_llm", return_value=stub):
        bundle, template = build_agent(settings=_IsolatedSettings())
    assert isinstance(bundle, AgentBundle)
```

**Rules:**
- Always patch `agent_core.templates.base.create_llm` (not `agent_core.llm.create_llm`) — this is where templates call it
- Do NOT invoke `bundle.graph.ainvoke` in unit tests — LangGraph internals require a real LLM response format; test the graph invocation in integration tests with a real LLM (Ollama) or skip
- Test tools directly with `await my_tool("arg")` — no need for agent graph invocation

---

## ⚠️ Critical Rules

### Tool registry is global — always clear in tests

```python
# Without this, tests interfere with each other:
@pytest.fixture(autouse=True)
def _clean_registry():
    clear_registry()
    yield
    clear_registry()
```

### pydantic-settings env isolation in tests

`monkeypatch.delenv` alone does NOT prevent pydantic-settings from reading `.env.local`.
**Always use the `_IsolatedSettings` subclass pattern** (see section 1).

### create_llm() requires 2 arguments

```python
# ✅ Correct — 2 positional args: provider string + settings
llm = create_llm(settings.llm_provider, settings)

# ❌ Wrong — keyword-only
llm = create_llm(settings=my_settings)

# ❌ Wrong — single arg
llm = create_llm(my_settings)
```

### stub LLM — do NOT invoke the full graph

Invoking `bundle.graph.ainvoke` with a MagicMock LLM fails with `NotImplementedError: Unsupported message type: MagicMock`. Test the graph shape (has `ainvoke`) but not the full invocation chain.

### LangGraph 1.x migration — completed (agent-core internal)

`create_react_agent` from `langgraph.prebuilt` was removed in LangChain 1.x. agent-core internals have already migrated — verticals do NOT call `create_agent` directly; always use `template.build()` which handles this internally.

```python
# ✅ Verticals always use templates — never call create_agent directly
bundle = SalesCRMTemplate(settings=settings).build(extra_tools=[...])

# ❌ Do not use — agent-core internal only
from langchain.agents import create_agent
graph = create_agent(model=llm, tools=tools, system_prompt="...", checkpointer=checkpointer)

# ❌ Old (LangGraph 0.x) — do not use
from langgraph.prebuilt import create_react_agent
graph = create_react_agent(llm, tools, prompt=SystemMessage(content="..."), checkpointer=checkpointer)
```

Constraints: `langchain>=1.3.1`, `langchain-core>=1.4.0`, `langgraph>=1.2.1`, `langchain-community>=0.4.1`.

### handle_tool_error auto-set in build_agent (v1.4.0+)

`build_agent()` sets `handle_tool_error=True` on every `BaseTool` before creating the graph.
`ToolException` is caught at the tool level and returned as an error message to the LLM — agent self-corrects.
Tools with a custom `handle_tool_error` handler already set are NOT overridden.

Note: only `ToolException` is handled at the tool level. Generic transport exceptions (HTTP errors, auth failures)
can still propagate through. Add a `_wrap_tool_errors()` wrapper (see section 11) for full crash protection
in MCP-heavy agents.

---

## 11. MCPRegistry — multi-server MCP integration

**Token provider pattern** — MSAL handles caching internally.
Never capture the token at startup (`lambda: token`): the string becomes stale after ~1h.
Pass a live callable so every `get_tools()` call triggers MSAL silent acquisition:

```python
# ✅ Correct — MSAL acquires silently when token is expired
token_provider = lambda: get_d365_token(settings)
tools = await registry.get_tools()   # token_provider called here

# ❌ Wrong — token captured at startup, stale after ~1h
token = get_d365_token(settings)
token_provider = lambda: token   # always the same string
```

**Deduplicate URL construction** — extract a private helper to avoid repeating the
dataverse/sales config logic in multiple functions:

```python
from agent_core.connectors import MCPRegistry, MCPServiceConfig, TokenProviderAuth

_SALES_MCP_BASE = "https://api.powerplatform.com/mcp/environments/{env_id}/servers/msdyn_SalesMCPServer"

def _build_server_configs(
    token_provider: Callable[[], str],
    settings: MySettings,
) -> list[MCPServiceConfig]:
    auth = TokenProviderAuth(token_provider=token_provider)
    configs = [
        MCPServiceConfig(name="dataverse", url=f"{settings.environment_url}/api/mcp", auth=auth),
    ]
    if settings.mcp_environment_id:
        configs.append(
            MCPServiceConfig(
                name="sales",
                url=_SALES_MCP_BASE.format(env_id=settings.mcp_environment_id),
                auth=auth,
            )
        )
    return configs


async def get_tools_resilient(token_provider: Callable[[], str], settings: MySettings) -> list[BaseTool]:
    all_tools: list[BaseTool] = []
    for cfg in _build_server_configs(token_provider, settings):
        registry = MCPRegistry(configs=[cfg])
        tools = await registry.get_tools()
        if tools:
            all_tools.extend([_wrap_tool_errors(_patch_tool(t)) for t in tools])
    return all_tools
```

**MCPRegistry API**:
- `MCPRegistry(configs: list[MCPServiceConfig])`
- `MCPServiceConfig(name, url, auth, transport='streamable_http', enabled=True)` — HTTP transport
- `MCPServiceConfig(name, command, args, env, transport='stdio')` — stdio transport
- `MCPRegistry.get_tools() → list[BaseTool]` — **async** — always `await`
- `MCPRegistry.configs` — public property, returns `list[MCPServiceConfig]` copy (read-only)
- `MCPRegistry.add_config(config: MCPServiceConfig)` — add or replace by name (runtime mutation)
- `MCPRegistry.remove_config(name: str) → bool` — remove by name, returns `True` if removed
- Per-server error isolation: one server failure does not zero all tools (BUG-002, fixed v1.4.0)
- Validation: HTTP without `url` or stdio without `command` → warning + skip (no crash)

### MCPServiceConfig — stdio transport (v1.6.0+)

For MCP servers that run as local subprocesses (e.g. filesystem MCP, language server MCP):

```python
from agent_core.connectors import MCPRegistry, MCPServiceConfig

# stdio MCP server — launched as subprocess
local_cfg = MCPServiceConfig(
    name="local-mcp",
    command="npx",
    args=["my-mcp-server", "serve"],
    env={"HOME": os.path.expanduser("~")},
    transport="stdio",
)

# Standard HTTP MCP — unchanged
dataverse_cfg = MCPServiceConfig(
    name="dataverse",
    url="https://org.crm.dynamics.com/api/mcp",
    auth=TokenProviderAuth(token_provider=lambda: get_d365_token(settings)),
)

# Mix both in one registry
registry = MCPRegistry([local_cfg, dataverse_cfg])
tools = await registry.get_tools()
```

**Stdio transport rules:**
- `command` required — server skipped with warning if empty
- `args` optional — command-line arguments for subprocess
- `env` optional — extra env vars passed to subprocess (merged with system env by `MultiServerMCPClient`)
- `auth` ignored for stdio — subprocess manages its own auth
- `url` ignored for stdio

**Stderr noise from stdio servers:** some MCP servers emit debug output on stderr.
Wrap with `bash -c "... 2>/dev/null"` if it interferes with the transport:

```python
MCPServiceConfig(
    name="noisy-server",
    command="bash",
    args=["-c", "npx some-mcp-server serve 2>/dev/null"],
    transport="stdio",
)
```

```python
# Runtime server mutation (e.g. add a server after initial build)
registry.add_config(MCPServiceConfig(
    name="extra_server",
    url="https://api.example.com/mcp",
    auth=BearerTokenAuth(token="my-token"),
))
registry.remove_config("extra_server")  # True
```

**Auth classes**: `NoAuth`, `ApiKeyAuth`, `BearerTokenAuth`, `TokenProviderAuth`, `MCPAuthProvider`.

**`args_schema` is a raw `dict` (JSON Schema) — NOT a Pydantic BaseModel.**
`langchain_mcp_adapters` sets `args_schema = tool.inputSchema` which is the server's raw JSON Schema.

```python
# ✅ Correct — read properties from dict
props: set[str] = set(schema.get("properties", {}))

# ❌ Wrong — AttributeError: 'dict' has no attribute 'model_fields'
props = set(schema.model_fields)
```

**Patching tools that advertise unsupported parameters** (e.g. Dataverse rejects `scope`):

```python
import copy
from langchain_core.tools import BaseTool, StructuredTool

_UNSUPPORTED: frozenset[str] = frozenset({"scope"})  # extend per-server as discovered

def _patch_tool(tool: BaseTool) -> BaseTool:
    """Remove unsupported params from MCP tool schema and call path."""
    if not isinstance(tool, StructuredTool) or tool.coroutine is None:
        return tool
    schema = getattr(tool, "args_schema", None)
    if not isinstance(schema, dict):
        return tool
    bad = _UNSUPPORTED & set(schema.get("properties", {}))
    if not bad:
        return tool
    new_schema = copy.deepcopy(schema)
    for p in bad:
        new_schema.get("properties", {}).pop(p, None)
        req: list[str] = new_schema.get("required", [])
        if p in req:
            req.remove(p)
    original = tool.coroutine
    async def _coro(**kwargs: object) -> object:
        for p in bad:
            kwargs.pop(p, None)
        return await original(**kwargs)
    return StructuredTool(
        name=tool.name,
        description=tool.description,
        args_schema=new_schema,
        coroutine=_coro,
        response_format=tool.response_format,  # MUST preserve — MCP tools use 'content_and_artifact'
        metadata=tool.metadata,
    )
```

**`response_format` MUST be preserved.** MCP tools use `response_format="content_and_artifact"`.
Omitting it when rebuilding `StructuredTool` breaks result handling silently.

**Wrapping transport errors** (HTTP failures, auth errors — not covered by `handle_tool_error`):

```python
def _wrap_tool_errors(tool: BaseTool) -> BaseTool:
    """Catch all exceptions inside the MCP coroutine and return as error content."""
    if not isinstance(tool, StructuredTool) or tool.coroutine is None:
        return tool
    original_coro = tool.coroutine
    async def _coro(**kwargs: object) -> object:
        try:
            return await original_coro(**kwargs)
        except Exception as exc:  # noqa: BLE001 — intentional catch-all for MCP transport errors
            # response_format="content_and_artifact" expects (content_blocks, artifact)
            return ([{"type": "text", "text": str(exc)}], None)
    return StructuredTool(
        name=tool.name, description=tool.description,
        args_schema=tool.args_schema, coroutine=_coro,
        response_format=tool.response_format, metadata=tool.metadata,
    )

# Apply after every get_tools() call — order matters: patch schema first, then wrap errors
tools = [_wrap_tool_errors(_patch_tool(t)) for t in raw_tools]
```

**Testing MCPRegistry** — do NOT pass `MagicMock()` as tool to `extra_tools`:

```python
# ❌ LangGraph calls create_tool() on MagicMock → TypeError
bundle = template.build(extra_tools=[MagicMock()])

# ✅ Patch AgentTemplate.build() to intercept extra_tools list
with patch("agent_core.templates.base.AgentTemplate.build") as mock_build:
    mock_build.return_value = MagicMock(spec=AgentBundle)
    build_agent(settings=settings, mcp_tools=[fake_tool])
mock_build.assert_called_once()
```

**Crash guard in ainvoke loop** — last resort for transport errors not caught by `_wrap_tool_errors`.
Mid-execution crash leaves an unanswered tool call in the checkpoint.
Reusing the same `thread_id` causes the next invocation to fail immediately.
Use a **module-level counter** — never parse the counter from the thread_id string:

```python
# Module-level — safe across calls, no string parsing that can ValueError
_session_counter: int = 0

async def _chat_loop(bundle: AgentBundle) -> None:
    global _session_counter
    config = {"configurable": {"thread_id": f"session-{_session_counter}"}}
    while True:
        user_input = input("You: ").strip()
        try:
            result = await bundle.graph.ainvoke({...}, config=config)
            reply = result["messages"][-1].content
        except Exception as exc:
            _session_counter += 1
            config = {"configurable": {"thread_id": f"session-{_session_counter}"}}
            print(f"[error] {exc}")
```

---

## agent-core package structure

```
agent_core/
  agent/          # build_agent(), AgentBundle, guardrails, recovery, retry, trimmer
  api/            # create_agent_router(), create_agent_app(), ChatRequest
  auth/           # JWTValidator, AbstractAuthProvider, AuthClaims, credential store
  cancellation/   # CancellationToken, CancelledError — cooperative cancellation
  cli/            # python -m agent_core.cli.repl
  config/         # BaseAgentSettings
  connectors/     # AbstractConnector, ConnectorProxy, MockConnector, MCPRegistry
  history/        # StorageBackend impls + create_checkpointer() bridge
  hooks/          # HookManager, lifecycle events (Before/After Invocation/Tool/Model)
  interrupts/     # Interrupt, InterruptResponse, InterruptSignal — human-in-the-loop
  llm/            # create_llm(), provider registry
  metrics/        # InvocationMetrics — loop cycles, tokens, latency
  observability/  # setup_tracing(settings), get_tracer(name)
  orchestration/  # Graph, Swarm, BaseAgentNode, MultiAgentOrchestrator
  plugins/        # Plugin protocol — composable agent extensions
  prompt/         # PromptComposer, PromptLoader
  security/       # SecurityHeadersMiddleware, SSRFValidator
  snapshots/      # Snapshot, SnapshotManager — session persistence
  state/          # AgentState — JSON-serializable K/V store
  streaming/      # SSEGenerator, PipelineEventBus
  structured/     # parse_structured_output() — Pydantic model from agent text
  templates/      # AgentTemplate ABC, SalesCRMTemplate, FashionTemplate, DevAssistantTemplate
  tenant/         # TenantMiddleware, extract_tenant_id, require_role, AbstractTenantResolver
  tools/          # @register_tool, discover_tools, clear_registry
  tracking/       # EntityTracker, TrackedEntity
```

---

## 12. v2 Modules — Hooks, Plugins, Orchestration, and more

### Hooks — lifecycle event system

```python
from agent_core import HookManager, BeforeToolCallEvent, AfterToolCallEvent

hooks = HookManager()

async def log_tool(event: BeforeToolCallEvent):
    print(f"Calling tool: {event.tool_name}")

hooks.add_hook(BeforeToolCallEvent, log_tool)
await hooks.emit(BeforeToolCallEvent(tool_name="get_contact", args={"id": "c1"}))
```

Events: `BeforeInvocationEvent`, `AfterInvocationEvent`, `BeforeToolCallEvent`, `AfterToolCallEvent`, `BeforeModelCallEvent`, `AfterModelCallEvent`.

### Plugins — composable agent extensions

```python
from agent_core import Plugin, HookManager

class AuditPlugin:
    name = "audit"

    def init_agent(self, hooks: HookManager, context: dict) -> None:
        hooks.add_hook(AfterToolCallEvent, self._on_tool)

    def get_tools(self) -> list:
        return []

    async def _on_tool(self, event):
        log.info("Tool %s completed", event.tool_name)

# Pass to build_agent
bundle = template.build(extra_tools=[...], plugins=[AuditPlugin()])
```

### Orchestration — Graph and Swarm

```python
from agent_core import Graph, Swarm

# DAG orchestrator
graph = Graph()
graph.add_node("extract", extract_handler)
graph.add_node("transform", transform_handler)
graph.add_edge("extract", "transform")
result = await graph.invoke("raw data")

# Swarm — autonomous handoffs
swarm = Swarm(max_handoffs=5)
swarm.add_agent("triage", triage_handler)
swarm.add_agent("billing", billing_handler)
result = await swarm.invoke("My bill seems wrong")
# triage → billing (via {"handoff_to": "billing"})
```

### Structured Output

```python
from pydantic import BaseModel
from agent_core import parse_structured_output

class ContactCard(BaseModel):
    name: str
    email: str

result = parse_structured_output(agent_text, ContactCard)
if result:
    print(result.name)  # typed access
```

### Cancellation

```python
from agent_core import CancellationToken, CancelledError

token = CancellationToken()
# In another task: token.cancel("timeout")
token.check()  # raises CancelledError if cancelled
```

### Snapshots

```python
from agent_core import SnapshotManager, AgentState

mgr = SnapshotManager(storage_backend)
snap_id = await mgr.save_snapshot("thread-1", messages, AgentState())
snapshot = await mgr.restore_snapshot("thread-1", snap_id)
```

---

## 13. OpenTelemetry tracing

Call `setup_tracing` once at startup. No-op when `OTEL_ENABLED=false`.

```python
from agent_core.observability import setup_tracing, get_tracer

# At app startup (before serving requests)
setup_tracing(settings)  # registers OTLP/gRPC exporter

# In any module
tracer = get_tracer("my-vertical")
with tracer.start_as_current_span("my-operation"):
    ...
```

`get_tracer()` always returns a valid tracer — no-op if OTEL disabled.  
No need to guard on `settings.otel_enabled` at call sites.

Environment variables:
- `OTEL_ENABLED=true` — activates tracing
- `OTEL_EXPORTER_ENDPOINT=http://otel-collector:4317` — OTLP/gRPC endpoint

---

## 14. AgentTemplate — customization without subclassing

Available since v1.5.0. Two injection points:

### Custom system prompt

Pass `prompt_template=` to the constructor to override the built-in prompt:

```python
MY_PROMPT = """
You are a helpful assistant for {domain}.
Rules:
- Always confirm before creating records.
- Answer in Italian.
"""

template = SalesCRMTemplate(
    settings=settings,
    prompt_template=MY_PROMPT,   # replaces the default SalesCRM prompt
)
bundle = template.build(extra_tools=[...])
```

### Custom LLM

Pass `llm=` to `build()` to override the LLM resolved from settings:

```python
from langchain_openai import AzureChatOpenAI

custom_llm = AzureChatOpenAI(
    azure_endpoint="https://...",
    azure_deployment="gpt-4o",
    api_version="2024-08-01-preview",
)

bundle = SalesCRMTemplate(settings=settings).build(
    extra_tools=[...],
    llm=custom_llm,   # overrides create_llm(settings)
)
```

**When to subclass vs. inject:**

| Need | Pattern |
|---|---|
| Different role/persona | `prompt_template=` in constructor |
| Different LLM model/provider | `llm=` in `build()` |
| Different entity categories or rules | Subclass `AgentTemplate` (section 3) |

---

## 15. Decision guide — which template, storage, transport

### Which template?

| Domain | Template | Entity mapping covers |
|---|---|---|
| Any new domain (default) | `GenericTemplate` | none — neutral starting point |
| Sales / CRM / contacts | `SalesCRMTemplate` | contact, deal, activity |
| Fashion / e-commerce | `FashionTemplate` | product, order, look |
| Dev tooling / CI/CD | `DevAssistantTemplate` | pr, issue, pipeline |
| Fully custom domain | Subclass `AgentTemplate` | custom |

Default choice when unsure: `GenericTemplate` — neutral, zero entity mapping, works for any domain.

### Which storage backend?

| Scenario | Setting | Backend |
|---|---|---|
| Local dev / tests | `STORAGE_BACKEND=memory` | `MemoryStorageBackend` |
| Single process (prod) | `STORAGE_BACKEND=sqlite` | `SQLiteStorageBackend` |
| Multi-process / k8s | `STORAGE_BACKEND=postgres` | `PostgresStorageBackend` |

### Which LLM provider?

| Scenario | Setting |
|---|---|
| Local dev (no cloud cost) | `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=qwen3:8b` |
| Production (Azure) | `LLM_PROVIDER=azure_foundry`, `AZURE_FOUNDRY_MODEL=gpt-4o` |
| Proxy (any model) | `LLM_PROVIDER=litellm`, `LITELLM_MODEL=...` |

---

## 16. Public API surface — everything importable from `agent_core`

Complete list. All symbols available from `from agent_core import ...`:

```python
from agent_core import (
    # --- Agent (low-level — used internally by templates) ---
    # NOTE: verticals define a local build_agent() wrapper in main.py (returns tuple (bundle, template))
    # that calls template.build(). agent_core.build_agent is the low-level builder (returns AgentBundle only);
    # do NOT confuse the two — prefer templates for vertical development.
    build_agent,           # build_agent(llm, tools, system_prompt, settings, ...) -> AgentBundle (not a tuple)
    AgentBundle,           # dataclass: graph, settings, callbacks, recursion_limit, trim_history()

    # --- Templates ---
    AgentTemplate,         # ABC — subclass for custom domains
    GenericTemplate,       # ready-to-use: neutral starting point, no domain entity mapping
    SalesCRMTemplate,      # ready-to-use: contact/deal/activity
    FashionTemplate,       # ready-to-use: product/order/look
    DevAssistantTemplate,  # ready-to-use: pr/issue/pipeline

    # --- Settings ---
    BaseAgentSettings,     # pydantic-settings base — extend with domain fields

    # --- Tools ---
    register_tool,         # @register_tool(group, description, aliases) decorator
    get_all_enabled_tools, # get_all_enabled_tools() -> list[BaseTool]
    clear_registry,        # clear_registry() — also importable as: from agent_core.tools import clear_registry

    # --- LLM ---
    create_llm,            # create_llm(provider, settings) -> BaseChatModel

    # --- Prompt ---
    PromptComposer,        # PromptComposer(template=...).compose(role, rules, context)
    PromptLoader,          # PromptLoader — loads from YAML/Markdown files

    # --- Auth ---
    JWTValidator,          # JWTValidator(jwks_url, audience, issuer)
    AbstractAuthProvider,  # ABC for custom auth — implement validate(token) -> AuthClaims
    AuthClaims,            # dataclass: subject, tenant_id, roles, raw: dict[str, Any]
    AbstractCredentialStore,  # ABC for credential stores
    InMemoryCredentialStore,  # in-memory credential store

    # --- Hooks (v2) ---
    HookManager,           # add_hook(event_type, callback, order) / emit(event)
    BeforeInvocationEvent, AfterInvocationEvent,
    BeforeToolCallEvent, AfterToolCallEvent,
    BeforeModelCallEvent, AfterModelCallEvent,

    # --- Plugins (v2) ---
    Plugin,                # Protocol: name, init_agent(hooks, context), get_tools()

    # --- State (v2) ---
    AgentState,            # JSON-serializable K/V store: get/set/delete/has/to_dict/from_dict

    # --- Retry (v2) ---
    RetryStrategy,         # ABC
    NoRetry, ExponentialBackoffRetry, LinearBackoffRetry, ConstantBackoffRetry,

    # --- Interrupts (v2) ---
    Interrupt,             # dataclass: id, name, reason, tool_name, metadata
    InterruptResponse,     # dataclass: interrupt_id, action, response
    InterruptSignal,       # Exception subclass — raise to pause agent

    # --- Metrics (v2) ---
    InvocationMetrics,     # loop_cycles, tokens, tool/model calls, latency_ms

    # --- Streaming (v2) ---
    PipelineEventBus,      # per-run_id asyncio.Queue SSE bus with backpressure
    SSEGenerator,

    # --- Orchestration (v2) ---
    MultiAgentOrchestrator,  # ABC: invoke(input) -> MultiAgentResult
    MultiAgentResult,        # dataclass: output, node_outputs, metadata
    Graph,                   # DAG orchestrator with conditional routing
    Swarm,                   # Autonomous handoff orchestrator
    SwarmAgent,              # Agent in a Swarm
    BaseAgentNode,           # ABC: retrieve_knowledge/execute/validate_output

    # --- Cancellation (v2) ---
    CancellationToken,     # Thread-safe cancel(reason), check() raises CancelledError
    CancelledError,        # Exception with reason attribute

    # --- Snapshots (v2) ---
    Snapshot,              # dataclass: snapshot_id, thread_id, timestamp, messages, agent_state
    SnapshotManager,       # save/restore/list/delete snapshots via StorageBackend

    # --- Structured Output (v2) ---
    parse_structured_output,  # parse_structured_output(text, schema) -> T | None

    # --- Tenant (v2) ---
    TenantMiddleware,        # ASGI middleware — binds tenant_id from JWT to ContextVar
    extract_tenant_id,       # extract from AuthClaims (direct, app_metadata, flat)
    get_current_tenant_id,   # read ContextVar
    require_role,            # FastAPI dependency factory for RBAC
    AbstractTenantResolver,  # ABC for cross-tenant FK resolution

    # --- Storage ---
    MemoryStorageBackend,
    SQLiteStorageBackend,
    PostgresStorageBackend,

    # --- Connectors ---
    AbstractConnector,
    ConnectorProxy,
    MockConnector,

    # --- MCP ---
    MCPRegistry,           # MCPRegistry(configs=[...])
    MCPServiceConfig,      # MCPServiceConfig(name, url, auth, transport, enabled)
    MCPAuthProvider,       # ABC for custom MCP auth
    BearerTokenAuth,       # static token
    TokenProviderAuth,     # callable token — use for MSAL/OAuth refresh
    ApiKeyAuth,
    NoAuth,

    # --- Tracking ---
    EntityTracker,
    TrackedEntity,

    # --- Security ---
    SecurityHeadersMiddleware,  # importable from agent_core root
    SSRFValidator,

    # --- Observability ---
    setup_tracing,         # setup_tracing(settings) — call once at startup
    get_tracer,            # get_tracer(name) -> Tracer — no-op when OTEL disabled
)
```

---

## 17. Multi-Tenant patterns

### TenantMiddleware — ContextVar binding

Extracts `tenant_id` from JWT claims and stores it in a `ContextVar` for the request.

```python
from agent_core.tenant import TenantMiddleware, get_current_tenant_id

app = FastAPI()
app.add_middleware(TenantMiddleware)

@app.get("/items")
async def list_items():
    tenant_id = get_current_tenant_id()
    return await repo.list_items(tenant_id)
```

**Rules:**
- Add `TenantMiddleware` **after** auth middleware — `request.state.auth_claims` must be set first
- Repository functions receive `tenant_id` as explicit parameter — never read from global state inside repos
- `get_current_tenant_id()` returns `None` outside a request context (e.g. background tasks)

### extract_tenant_id — nested JWT claims

Supabase stores `tenant_id` inside `app_metadata`, not at the top level.

```python
from agent_core.tenant import extract_tenant_id

# Checks (in order):
# 1. claims.tenant_id (direct attribute)
# 2. claims.raw["app_metadata"]["tenant_id"] (Supabase pattern)
# 3. claims.raw["tenant_id"] (flat JWT)
tenant_id = extract_tenant_id(claims)
```

### RBAC — require_role() dependency factory

```python
from agent_core.tenant import require_role
from agent_core.auth import AuthClaims

@router.post("/tenants")
async def create_tenant(
    claims: AuthClaims = Depends(require_role("sf_super_admin")),
):
    ...

@router.post("/settings")
async def update_settings(
    claims: AuthClaims = Depends(require_role("admin", "manager")),
):
    ...
```

**Rules:**
- `require_role` returns the claims — use it as the claims dependency directly
- Check is OR logic (`any(r in claims.roles for r in roles)`)
- Returns 403 Forbidden, not 401 (user is authenticated but lacks permission)

### Cross-tenant FK resolution

```python
from agent_core.tenant import AbstractTenantResolver

class ProjectTenantResolver(AbstractTenantResolver):
    async def resolve(self, resource_id: str, user_tenant_id: str) -> str:
        project = await db.get_project(resource_id)
        if project.tenant_id != user_tenant_id and \
           project.client_tenant_id != user_tenant_id:
            raise PermissionError("Access denied")
        return project.tenant_id
```

### Thread ID scoping

```python
# Scope LangGraph thread_id to tenant + user to prevent cross-tenant history leakage
scoped_thread_id = f"{tenant_id}:{user_sub}"
config = {"configurable": {"thread_id": scoped_thread_id}}
```

### RLS as second line of defense

```sql
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON items FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- service_role bypasses RLS (admin, seed scripts)
CREATE POLICY "service_all" ON items FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

- RLS catches bugs in the application layer — never rely on it as the only filter
- Application code must still filter by `tenant_id` (performance: avoids full table scans)

### Audit logging — swallow exceptions

```python
async def audit_log(tenant_id: str, action: str, details: dict) -> None:
    try:
        await db.insert_audit_log(tenant_id=tenant_id, action=action, details=details)
    except Exception:
        logger.exception("Audit log write failed for %s/%s", tenant_id, action)
        # Swallow — audit failure must not break the request
```

