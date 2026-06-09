"""Chat SSE endpoint for CrocFit AI coach."""

import json
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from croc_fit_api.schemas.models import ChatRequest
from croc_fit_api.tools.safety import check_safety

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# Module-level cache — bundle is built once on first request.
_agent_bundle: Any | None = None
_agent_bundle_initialized: bool = False


def _get_agent() -> Any | None:
    """Return the agent bundle, building it once on first call.

    Caches the result at module level to avoid rebuilding on every request.
    Returns None if agent-core is not installed.
    """
    global _agent_bundle, _agent_bundle_initialized
    if not _agent_bundle_initialized:
        _agent_bundle_initialized = True
        try:
            from croc_fit_api.main import build_agent  # type: ignore[import]
            bundle, _ = build_agent()
            _agent_bundle = bundle
            logger.info("agent_bundle_loaded")
        except (ImportError, Exception) as exc:
            logger.warning("agent_bundle_unavailable", error=str(exc))
            _agent_bundle = None
    return _agent_bundle


async def _stream_agent_response(
    bundle: Any,
    request: ChatRequest,
    safety_disclaimer: str = "",
) -> AsyncGenerator[str]:
    """Stream SSE events from the LangGraph agent.

    Applies safety disclaimer as a final chunk when the user message
    triggered a health/injury red flag (REQ-023).

    Args:
        bundle: Agent bundle returned by build_agent().
        request: Validated chat request with message and thread context.
        safety_disclaimer: Optional disclaimer text to append at end of stream.

    Yields:
        SSE-formatted data strings (data: <json>\\n\\n).
    """
    messages = [{"role": m.role, "content": m.content} for m in request.history]
    messages.append({"role": "user", "content": request.message})

    config = {
        "configurable": {
            "thread_id": f"{request.user_id}:{request.thread_id}",
            "user_id": request.user_id,
        }
    }

    emitted_content = False
    had_error = False
    last_tool_results: list[str] = []
    tool_errors: list[str] = []
    tools_called = 0
    try:
        async for event in bundle.graph.astream_events(
            {"messages": messages},
            config=config,
            version="v2",
        ):
            kind = event.get("event")
            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"].content
                if chunk:
                    emitted_content = True
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            elif kind == "on_tool_end":
                # Collect tool results as fallback when model emits no text.
                output = event.get("data", {}).get("output")
                tool_name = event.get("name", "")
                tools_called += 1
                if output is not None:
                    last_tool_results.append(
                        f"[{tool_name}] {json.dumps(output, ensure_ascii=False, default=str)[:500]}"
                    )
            elif kind == "on_tool_error":
                tool_name = event.get("name", "tool")
                err = event.get("data", {}).get("error", "unknown error")
                tool_errors.append(f"{tool_name}: {err}")
                logger.warning("agent_tool_error", tool=tool_name, error=str(err))
    except Exception as exc:
        logger.exception("agent_stream_error", error=str(exc))
        had_error = True
        yield f"data: {json.dumps({'error': 'Agent error occurred'})}\n\n"
    finally:
        if safety_disclaimer:
            yield f"data: {json.dumps({'chunk': safety_disclaimer})}\n\n"
        if not emitted_content and not had_error:
            # Model returned no text (tool-only response or silent agent).
            # Emit tool results summary so the frontend shows something useful.
            logger.warning(
                "agent_emitted_no_content",
                user_id=request.user_id,
                tools_called=tools_called,
            )
            if last_tool_results:
                summary = "✅ Operazione completata.\n\n" + "\n".join(last_tool_results)
            else:
                summary = "✅ Operazione completata."
            yield f"data: {json.dumps({'chunk': summary})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"


@router.post("/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    """Stream the AI coach response as Server-Sent Events.

    Applies safety pre-check on the user message (REQ-023/REQ-024).
    Requires a valid ChatRequest body. Streams JSON chunks as SSE.
    Returns a 200 StreamingResponse with media_type text/event-stream.
    """
    safety = check_safety(body.message)
    if safety.has_red_flag:
        logger.info(
            "safety_flag_detected",
            user_id=body.user_id,
            matched=safety.matched_terms,
        )

    bundle = _get_agent()
    if bundle is None:
        # Fallback: echo stub when agent-core is not yet installed
        async def _stub() -> AsyncGenerator[str]:
            yield f"data: {json.dumps({'chunk': '[agent-core not installed — stub response]'})}\n\n"
            if safety.disclaimer:
                yield f"data: {json.dumps({'chunk': safety.disclaimer})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(
            _stub(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    logger.info("chat_stream_started", user_id=body.user_id, thread_id=body.thread_id)
    return StreamingResponse(
        _stream_agent_response(bundle, body, safety_disclaimer=safety.disclaimer),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
