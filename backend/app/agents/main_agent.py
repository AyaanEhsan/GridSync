"""Main LangChain agent for Electric Grid Operator queries.

Uses LangChain 1.0's unified ``create_agent`` API with the Gemini chat model
configured via ``GEMINI_MODEL`` / ``GEMINI_API_KEY`` in the project ``.env``.

Tools:

- ``get_current_time``: ISO-8601 UTC timestamp.
- ``search_nerc_documents``: hybrid (dense + sparse) search over the Qdrant
  collection of NERC reliability documents, always returning the top-5 chunks
  with Cohere-reranked scores plus any Neo4j knowledge-graph triples adjacent
  to each chunk. Mirrors the ``/nerc-vector-search`` HTTP route but runs
  in-process so the agent doesn't have to make an HTTP call to itself.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, AsyncIterator, Dict

from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

NERC_SEARCH_TOP_K = 5


@tool
def get_current_time() -> str:
    """Return the current server time as an ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


@lru_cache(maxsize=1)
def _get_search_components():
    """Lazy-init Qdrant store + dense/sparse embedders once per process."""
    from gridsync import DenseEmbedder, QdrantStore, SparseEmbedder

    return QdrantStore(), DenseEmbedder(), SparseEmbedder()


@lru_cache(maxsize=1)
def _get_neo4j_store():
    """Lazy-init the Neo4j knowledge-graph store once per process."""
    from gridsync import Neo4jStore

    return Neo4jStore()


def _format_relationships(store: Any, file_id: str, chunk_num: str) -> str:
    """Render Neo4j triples adjacent to a ``DocumentChunk`` as compact text."""
    try:
        triples = store.query_based_on_file_id_and_chunk_no(
            file_id=file_id, chunk_num=chunk_num
        )
    except Exception:
        return ""
    lines: list[str] = []
    for t in triples or []:
        from_node = ",".join(list(t.get("from_node") or [])) or "?"
        to_node = ",".join(list(t.get("to_node") or [])) or "?"
        rel = t.get("relationship") or "?"
        lines.append(f"({from_node})-[{rel}]->({to_node})")
    return "; ".join(lines)


@tool
def search_nerc_documents(query: str) -> str:
    """Search NERC reliability documents for context relevant to an Electric
    Grid Operator question.

    Use this for any question about grid frequency, voltage, generation,
    transmission, balancing-authority operations (e.g. ERCOT, PJM, MISO),
    reliability standards, or weather-related grid risk. Returns the top-5
    most relevant document chunks (Cohere-reranked) with their text, metadata,
    and any adjacent Neo4j knowledge-graph triples.

    Args:
        query: A focused natural-language search query. Include the relevant
            grid signals (frequency, zone, weather, etc.) for best recall.
    """
    from gridsync import hybrid_search

    store, dense, sparse = _get_search_components()
    hits = hybrid_search(
        store=store,
        dense_embedder=dense,
        sparse_embedder=sparse,
        query_text=query,
        top_k=NERC_SEARCH_TOP_K,
    )

    try:
        graph = _get_neo4j_store()
    except Exception:
        graph = None

    if not hits:
        return "No relevant NERC document chunks found."

    sections: list[str] = []
    for rank, h in enumerate(hits, start=1):
        payload = dict(h.payload or {})
        text = (payload.pop("text", None) or "").strip()

        meta_bits: list[str] = []
        for key in ("source", "title", "file_id", "chunk_no", "page", "section"):
            val = payload.get(key)
            if val is not None and val != "":
                meta_bits.append(f"{key}={val}")
        meta_str = ", ".join(meta_bits) if meta_bits else "(no metadata)"

        rel_str = ""
        file_id = payload.get("file_id")
        chunk_no = payload.get("chunk_no")
        if graph is not None and file_id and chunk_no is not None:
            rel_str = _format_relationships(graph, str(file_id), str(chunk_no))

        header = (
            f"[Chunk {rank}] rerank={h.rerank_score:.3f} "
            f"dense={h.dense_score if h.dense_score is None else f'{h.dense_score:.3f}'} "
            f"sparse={h.sparse_score if h.sparse_score is None else f'{h.sparse_score:.3f}'} "
            f"| {meta_str}"
        )
        body = text or "(empty chunk)"
        rels = f"\nGraph: {rel_str}" if rel_str else ""
        sections.append(f"{header}\n{body}{rels}")

    return "\n\n".join(sections)


SYSTEM_PROMPT = (
    "You are GridSync, an AI assistant for Electric Grid Operators. "
    "Your job is to help the operator interpret real-time grid signals "
    "(frequency, voltage, balancing-authority zone, weather, generation mix, "
    "etc.) against NERC reliability standards and historical event reports. "
    "\n\n"
    "Tool use:\n"
    "- For ANY question about grid conditions, reliability, NERC standards, "
    "balancing authorities (ERCOT, PJM, MISO, WECC, SPP, NPCC, etc.), "
    "frequency/voltage excursions, weatherization, or load/generation events, "
    "you MUST call `search_nerc_documents` first with a focused query (include "
    "the key signals such as frequency value, zone, and weather) to retrieve "
    "the top-5 relevant chunks. You may call it more than once with different "
    "queries if the first set of chunks doesn't cover the question.\n"
    "- Use `get_current_time` only if the operator explicitly asks for the "
    "current time or date.\n"
    "\n"
    "Answering rules:\n"
    "1. Ground every claim in the retrieved chunks. Reference chunk numbers "
    "(e.g. \"per Chunk 2\") and any metadata (source, file_id, section) when "
    "citing.\n"
    "2. Explicitly flag reliability risks and out-of-bounds operating "
    "conditions. For example, the Eastern/Western/Texas Interconnections in "
    "North America operate at a nominal 60 Hz, so a reading of 50 Hz in ERCOT "
    "is a severe anomaly, not normal operation.\n"
    "3. Call out weather-related risks (e.g. cold-weather generation "
    "deratings, gas-supply curtailments, icing) when the operator provides a "
    "temperature.\n"
    "4. If the retrieved context does not cover the question, say so plainly "
    "instead of speculating.\n"
    "5. Keep answers concise, structured, and actionable for a control-room "
    "operator: list the issues, the supporting evidence, and recommended next "
    "checks."
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
        tools=[get_current_time, search_nerc_documents],
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
