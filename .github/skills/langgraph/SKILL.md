---
name: langgraph
description: Patterns for LangGraph ReAct agents with LangChain tool calling, MemorySaver checkpointing, multi-tenant isolation, SSE streaming, and HallucinationGuard. Load when building or debugging LangGraph agents.
applyTo: "**"
---

## Context7 — Query before implementing

| Task | Library ID | Topic |
|---|---|---|
| LangGraph agent, streaming, state | `langchain-ai/langgraph` | `create_react_agent` / `astream_events` / `state` |
| LangChain tools, callbacks | `langchain-ai/langchain` | `tools` / `callbacks` / `BaseCallbackHandler` |

---

## Stack

- LangGraph `create_react_agent` (from `langgraph.prebuilt`)
- `MemorySaver` — in-memory checkpointer (module-level singleton)
- `HallucinationGuard` — `BaseCallbackHandler` post-validates LLM messages

---

## ⚠️ Critical Rules (learned from real errors)

### MemorySaver singleton — NEVER per-request

```python
# ❌ Wrong — creates new state on every request (history lost)
@router.post("/chat")
async def chat():
    agent = build_agent()  # new MemorySaver each time

# ✅ Correct — singleton at module level
_graph, _guard = build_agent()
```

Module-level singleton → history persists across requests. Per-request instantiation resets state every call.

### max_tokens — minimum 2048

`max_tokens=1024` causes empty AIMessage on Azure AI Foundry `model-router`. Tool schemas + system prompt exhaust the first 1024 tokens; the second LLM call has zero budget.

```python
llm = AzureChatOpenAI(..., max_tokens=2048)  # always 2048 or higher
```

### recursion_limit — always set

Without `recursion_limit`, agent can loop indefinitely on tool errors.

```python
invoke_config = {"configurable": ..., "recursion_limit": 12}
```

### Guard reset per request

```python
guard.reset()  # mandatory before each ainvoke — otherwise known_ids from previous request bleeds in
result = await agent.ainvoke(..., config={"callbacks": [guard]})
```

### Always use `ainvoke` from async handlers

Sync `invoke()` called from an `async def` does NOT guarantee correct ContextVar propagation to its internal thread pool.

```python
# ❌ sync invoke — ContextVar NOT propagated to tool threads
result = agent.invoke({"messages": messages})

# ✅ correct
result = await agent.ainvoke({"messages": messages})
```

### Tool docstring compression

LangChain injects tool docstrings verbatim into the LLM context. Every token in docstrings = token consumed per call. Keep docstrings to 1–2 lines.

### Do NOT invoke full graph with stub LLM in unit tests

`agent.ainvoke()` with a MagicMock LLM fails with `NotImplementedError: Unsupported message type: MagicMock`. In unit tests only verify `hasattr(bundle.graph, 'ainvoke')`. Reserve full graph invocation for integration tests with a real LLM.

---

## MemorySaver singleton pattern

```python
# agent.py — module level
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

_checkpointer = MemorySaver()  # ONE instance per process

def build_agent(
    settings: MySettings | None = None,
    extra_tools: list = [],
    checkpointer=None,
) -> tuple:
    """Returns (graph, guard) tuple."""
    s = settings or MySettings()
    llm = create_llm(settings=s)
    guard = HallucinationGuard()
    system = SystemMessage(content="Your system prompt here.")
    graph = create_react_agent(
        llm,
        tools + extra_tools,
        prompt=system,
        checkpointer=checkpointer or _checkpointer,
    )
    return graph, guard
```

---

## invoke_config pattern

```python
from langchain_core.messages import HumanMessage

agent, guard = build_agent()
scoped_thread_id = f"{tenant}:{session_id}"  # multi-tenant isolation

guard.reset()
invoke_config = {
    "configurable": {"thread_id": scoped_thread_id},
    "recursion_limit": 12,
    "callbacks": [guard],
}

result = await agent.ainvoke(
    {"messages": [HumanMessage(content=user_message)]},
    config=invoke_config,
)
answer = result["messages"][-1].content
```

---

## Multi-tenant isolation — scoped thread_id

```python
# Prevents cross-tenant history access in shared MemorySaver
scoped_thread_id = f"{tenant}:{session_id}"
# tenant = JWT `sub` when auth present, falls back to body/settings value
```

---

## SSE streaming via `astream_events`

```python
import json
from fastapi.responses import StreamingResponse

async def _event_gen(agent, messages: list, config: dict):
    async for event in agent.astream_events(
        {"messages": messages},
        config=config,
        version="v2",
    ):
        kind = event.get("event")
        if kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"].content
            if chunk:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
    yield f"data: {json.dumps({'done': True})}\n\n"

@router.post("/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    ...
    return StreamingResponse(
        _event_gen(agent, messages, invoke_config),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

---

## HallucinationGuard

```python
from langchain_core.callbacks import BaseCallbackHandler

class HallucinationGuard(BaseCallbackHandler):
    """Validates LLM messages against known entity IDs.

    on_tool_end: accumulates raw tool output tokens into _known_ids.
    on_tool_start: checks IDs passed to write tools against _known_ids.
    on_llm_end: post-validates final LLM message, logs suspected hallucinations.
    reset(): call before each request to clear per-turn state.
    """

    def __init__(self) -> None:
        super().__init__()
        self._known_ids: set[str] = set()

    def reset(self) -> None:
        self._known_ids = set()
```

Guards must be reset before each request:

```python
guard.reset()
result = await agent.ainvoke(..., config={"callbacks": [guard]})
```

---

## Cross-restart history persistence (optional)

If you need history to survive process restarts (e.g. serverless deployments), persist to an external store and warm up the in-memory checkpointer on first request:

```python
async def warmup_checkpointer(
    session_id: str,
    user_id: str,
    agent,
    scoped_thread_id: str,
) -> None:
    """Load persisted history → inject into MemorySaver via aupdate_state."""
    messages = await load_history_from_db(session_id, user_id)
    if messages:
        config = {"configurable": {"thread_id": scoped_thread_id}}
        await agent.aupdate_state(config, {"messages": messages})

# In chat handler — before ainvoke
if not has_checkpointer_state(agent, scoped_thread_id):
    await warmup_checkpointer(session_id, tenant, agent, scoped_thread_id)

# After ainvoke — persist sliding window (last 10 turns)
await save_turn_to_db(session_id, tenant, result["messages"])
```

---

## Token budget (Azure Foundry model-router reference)

| Component | ~Tokens |
|---|---|
| Tool schemas (20 tools) | ~1500 |
| System prompt | ~400 |
| Entity context | ~150–200 |
| User message | variable |
| **Total input minimum** | **~2500** |

Budget left for generation: `max_tokens − tool_schema_overhead`. Never reduce `max_tokens` below 2048.

---

## Testing patterns

```python
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage

# ✅ verify graph is compiled — don't invoke with stub LLM
def test_agent_graph_has_compiled_graph():
    with patch("mymodule.agent.create_llm", return_value=MagicMock()):
        graph, guard = build_agent()
    assert hasattr(graph, "ainvoke")
    assert hasattr(guard, "reset")

# ✅ mock ainvoke in API tests
mock_agent = MagicMock()
mock_agent.ainvoke = AsyncMock(return_value={"messages": [AIMessage(content="answer")]})
```

---

## Two-phase HIL via DB state machine (NOT native `interrupt()`)

LangGraph's native `interrupt()` is fragile with checkpointer state. Use a DB-backed state machine instead:

```python
# Phase 1: agent produces output → save to DB with status "awaiting_review"
result = await bundle.graph.ainvoke({"messages": messages}, config=config)
await db.save_pipeline_state(
    session_id=session_id,
    phase="analysis",
    status="awaiting_review",
    output=result["messages"][-1].content,
)

# Phase 2: user approves → resume from DB → run next phase
state = await db.get_pipeline_state(session_id)
if state.status == "approved":
    # Build a mini-graph for the next phase
    next_result = await next_phase_graph.ainvoke(
        {"messages": [HumanMessage(content=state.output)]},
        config=config,
    )
```

**Rules:**
- **Never** rely on `interrupt()` for production HIL — checkpointer state is fragile across restarts
- Store phase transitions in DB (e.g. `pipeline_states` table with `status` enum)
- Each phase is a separate mini-graph invocation
- Status flow: `pending` → `running` → `awaiting_review` → `approved`/`rejected` → `running` (next phase)

---

## BaseAgentNode ABC pattern (agent-core v2)

Three-phase contract for multi-agent pipelines:

```python
from agent_core import BaseAgentNode

class AnalysisAgent(BaseAgentNode):
    agent_type = "analysis"
    requires_review = True     # halts for HIL after execute()
    sequence_order = 1         # execution priority in graph

    async def retrieve_knowledge(self, context: dict) -> dict:
        # Fetch relevant data before execution
        return {"data": await fetch_from_db(context["input"])}

    async def execute(self, context: dict) -> dict:
        # Core agent logic
        return {"analysis": "..."}

    async def validate_output(self, output: dict) -> bool:
        # Post-execution validation
        return "analysis" in output and len(output["analysis"]) > 0

class ToneAdapter(BaseAgentNode):
    agent_type = "tone"
    requires_review = False    # no HIL — automatic pass-through
    sequence_order = 2
```

**Agents without HIL**: set `requires_review = False` (e.g. ToneAdapter, Formatter).

---

## StateGraph — explicit type argument

```python
from langgraph.graph import StateGraph
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    context: str

# ✅ Explicit type arg — required
graph = StateGraph[AgentState](AgentState)

# ❌ No type arg — mypy error
graph = StateGraph(AgentState)
```

---

## Mini-graph builders for pipeline phases

Build small, purpose-specific graphs for each phase instead of one large graph:

```python
def build_analysis_graph(llm, tools, checkpointer):
    """Phase 1: analyze input data."""
    return create_agent(
        model=llm,
        tools=[analyze_tool, search_tool],
        system_prompt="You are an analysis agent...",
        checkpointer=checkpointer,
    )

def build_generation_graph(llm, tools, checkpointer):
    """Phase 2: generate output from analysis."""
    return create_agent(
        model=llm,
        tools=[generate_tool, format_tool],
        system_prompt="You are a generation agent...",
        checkpointer=checkpointer,
    )
```

---

## Deprecation warnings (non-blocking)

- `create_react_agent` in LangGraph 0.2.x: moved to `langgraph.prebuilt`. Import `from langgraph.prebuilt import create_react_agent`.
- LangGraph 0.3.x+: `create_react_agent` API unchanged but may emit deprecation warnings → check Context7 for migration path before upgrading.
