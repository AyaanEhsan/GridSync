"""Main LangChain agent used to smoke-test the agentic endpoint plumbing.

Uses LangChain 1.0's unified ``create_agent`` API with the Gemini chat model
configured via ``GEMINI_MODEL`` / ``GEMINI_API_KEY`` in the project ``.env``.
The agent is intentionally minimal: a single in-process ``get_current_time``
tool, no link to any other GridSync endpoints or data stores.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, AsyncIterator, Dict

from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI


@tool
def get_current_time() -> str:
    """Return the current server time as an ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


SYSTEM_PROMPT = (
    "You are a friendly GridSync agent used purely for smoke-testing "
    "the agentic endpoint. If the user asks for the current time or date, "
    "call the get_current_time tool. Otherwise, answer briefly in plain text."
)


@lru_cache(maxsize=1)
def get_main_agent():
    """Build (and cache) the main agent.

    Raises ``RuntimeError`` if ``GEMINI_API_KEY`` is missing so the failure
    surfaces clearly through the FastAPI handler instead of at import time.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment / .env")

    model = ChatGoogleGenerativeAI(
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        google_api_key=api_key,
        temperature=0,
    )

    return create_agent(
        model=model,
        tools=[get_current_time],
        system_prompt=SYSTEM_PROMPT,
    )


def _extract_text(content: Any) -> str:
    """Pull plain text out of an LLM message chunk's ``content`` field.

    Gemini usually returns a plain string, but LangChain message chunks may also
    arrive as a list of content parts (``[{"type": "text", "text": "..."}]``).
    Anything else (tool-call deltas, images, etc.) is ignored here -- tool calls
    are surfaced via the dedicated ``on_tool_start`` / ``on_tool_end`` events.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                text = part.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


async def stream_main_agent(message: str) -> AsyncIterator[Dict[str, Any]]:
    """Stream events from the main agent as it reasons over ``message``.

    Yields plain dicts shaped for SSE. Each dict has a ``type`` discriminator:

    - ``token``: incremental LLM text deltas -- ``{"type": "token", "text": ...}``
    - ``tool_call``: a tool is about to run -- ``{"type": "tool_call", "name": ..., "args": {...}}``
    - ``tool_result``: tool finished -- ``{"type": "tool_result", "name": ..., "output": "..."}``
    - ``done``: stream finished cleanly -- ``{"type": "done"}``

    The route layer is responsible for serialising these into ``text/event-stream``.
    """
    agent = get_main_agent()

    async for event in agent.astream_events(
        {"messages": [{"role": "user", "content": message}]},
        version="v2",
    ):
        kind = event.get("event")

        if kind == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            text = _extract_text(getattr(chunk, "content", ""))
            if text:
                yield {"type": "token", "text": text}

        elif kind == "on_tool_start":
            yield {
                "type": "tool_call",
                "name": event.get("name", ""),
                "args": event.get("data", {}).get("input", {}) or {},
            }

        elif kind == "on_tool_end":
            output = event.get("data", {}).get("output")
            # ``output`` is typically a ToolMessage whose ``content`` holds the
            # actual tool return; fall back to ``str()`` for raw return values.
            output_content = getattr(output, "content", None)
            if output_content is None:
                output_str = "" if output is None else str(output)
            elif isinstance(output_content, str):
                output_str = output_content
            else:
                output_str = _extract_text(output_content) or str(output_content)
            yield {
                "type": "tool_result",
                "name": event.get("name", ""),
                "output": output_str,
            }

    yield {"type": "done"}
