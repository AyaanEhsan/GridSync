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
