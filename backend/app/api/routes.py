import json
from functools import lru_cache
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.api.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    AgentToolCall,
    Chunk,
    ChunkRelationship,
    ChunkRelationshipsResponse,
    HealthResponse,
    SearchRequest,
    SearchResponse,
)

router = APIRouter()

API_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(version=API_VERSION)


@lru_cache(maxsize=1)
def _get_search_components():
    """Lazy-init Qdrant store + embedders once per process."""
    from gridsync import DenseEmbedder, QdrantStore, SparseEmbedder

    return QdrantStore(), DenseEmbedder(), SparseEmbedder()


@lru_cache(maxsize=1)
def _get_neo4j_store():
    """Lazy-init the Neo4j knowledge-graph store once per process."""
    from gridsync import Neo4jStore

    return Neo4jStore()


def _relationships_for_file_chunk(
    store: Any, file_id: str, chunk_num: str
) -> list[ChunkRelationship]:
    """Triples adjacent to a ``DocumentChunk`` for ``file_id`` + ``chunk_num``."""
    triples = store.query_based_on_file_id_and_chunk_no(
        file_id=file_id, chunk_num=chunk_num
    )
    return [
        ChunkRelationship(
            from_node=list(t.get("from_node") or []),
            relationship=t["relationship"],
            to_node=list(t.get("to_node") or []),
        )
        for t in triples
    ]


@router.post("/nerc-vector-search", response_model=SearchResponse, tags=["rag"])
def nerc_vector_search(req: SearchRequest) -> SearchResponse:
    """Hybrid (dense + sparse) search over the Qdrant collection.

    Body: ``{"query": "...", "k": 5}``. Returns the top-k chunks with their
    fused score and payload metadata.
    """
    from gridsync import hybrid_search

    try:
        store, dense, sparse = _get_search_components()
        hits = hybrid_search(
            store=store,
            dense_embedder=dense,
            sparse_embedder=sparse,
            query_text=req.query,
            top_k=req.k,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"search failed: {exc}") from exc

    chunks: list[Chunk] = []
    for h in hits:
        payload = dict(h.payload or {})
        text = payload.pop("text", None)
        chunks.append(
            Chunk(
                id=h.id,
                score=h.score,
                dense_score=h.dense_score,
                sparse_score=h.sparse_score,
                rerank_score=h.rerank_score,
                text=text,
                metadata=payload,
            )
        )

    # After hybrid search + rerank, attach Neo4j edges for chunks that carry
    # file_id + chunk_no in metadata (from ingestion).
    try:
        store = _get_neo4j_store()
    except Exception:
        store = None
    for chunk in chunks:
        file_id = chunk.metadata.get("file_id")
        chunk_no = chunk.metadata.get("chunk_no")
        if not file_id or chunk_no is None or store is None:
            continue
        try:
            chunk.relationships = _relationships_for_file_chunk(
                store, str(file_id), str(chunk_no)
            )
        except Exception:
            continue

    return SearchResponse(query=req.query, chunks=chunks)


@router.get(
    "/graph/chunks/{file_id}/{chunk_num}/relationships",
    response_model=ChunkRelationshipsResponse,
    tags=["graph"],
)
def chunk_relationships(file_id: str, chunk_num: str) -> ChunkRelationshipsResponse:
    """Return the (from, rel, to) triples adjacent to a single ``DocumentChunk``.

    Looks up the ``DocumentChunk`` node identified by ``file_id`` + ``chunk_num``
    in the Neo4j knowledge graph and returns one entry per incident edge. If the
    chunk does not exist or has no relationships, ``relationships`` is empty.
    """
    try:
        store = _get_neo4j_store()
        relationships = _relationships_for_file_chunk(store, file_id, chunk_num)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"graph query failed: {exc}"
        ) from exc

    return ChunkRelationshipsResponse(
        file_id=file_id, chunk_num=chunk_num, relationships=relationships
    )


@router.post("/agent/main", response_model=AgentChatResponse, tags=["agent"])
def agent_main_chat(req: AgentChatRequest) -> AgentChatResponse:
    """Smoke-test endpoint for the main LangChain agent backed by Gemini.

    Sends ``req.message`` to a minimal ``create_agent`` agent that has a single
    in-process ``get_current_time`` tool. Returns the agent's final reply and
    any tool calls it made along the way.
    """
    from app.agents.main_agent import get_main_agent

    try:
        agent = get_main_agent()
        result = agent.invoke(
            {"messages": [{"role": "user", "content": req.message}]}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"agent failed: {exc}") from exc

    messages = result.get("messages", []) if isinstance(result, dict) else []

    reply = ""
    for msg in reversed(messages):
        content = getattr(msg, "content", None)
        if isinstance(content, str) and content.strip():
            reply = content
            break
        if isinstance(content, list):
            text_parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            joined = "".join(text_parts).strip()
            if joined:
                reply = joined
                break

    tool_calls: list[AgentToolCall] = []
    for msg in messages:
        for tc in getattr(msg, "tool_calls", None) or []:
            tool_calls.append(
                AgentToolCall(
                    name=tc.get("name", ""),
                    args=tc.get("args", {}) or {},
                )
            )

    return AgentChatResponse(reply=reply, tool_calls=tool_calls)


def _format_sse(event_type: str, payload: dict[str, Any]) -> str:
    """Serialise an event as a single SSE record.

    SSE wire format is ``event: <type>\\ndata: <json>\\n\\n``. ``json.dumps`` is
    called with ``default=str`` so that non-JSON-native values surfacing from
    tool args/outputs (datetimes, Pydantic models, etc.) don't blow up the stream.
    """
    data = json.dumps(payload, default=str, ensure_ascii=False)
    return f"event: {event_type}\ndata: {data}\n\n"


@router.post("/agent/main/stream", tags=["agent"])
async def agent_main_chat_stream(req: AgentChatRequest) -> StreamingResponse:
    """SSE variant of ``/agent/main``: streams tokens, tool calls, and tool results.

    The response is ``text/event-stream`` with these named events:

    - ``token``: ``{"text": "..."}`` -- one LLM text delta
    - ``tool_call``: ``{"name": "...", "args": {...}}`` -- a tool is about to run
    - ``tool_result``: ``{"name": "...", "output": "..."}`` -- tool finished
    - ``done``: ``{}`` -- stream finished cleanly
    - ``error``: ``{"detail": "..."}`` -- something went wrong; stream then closes
    """
    from app.agents.main_agent import stream_main_agent

    async def event_source() -> AsyncIterator[str]:
        try:
            async for evt in stream_main_agent(req.message):
                event_type = evt.pop("type", "message")
                yield _format_sse(event_type, evt)
        except Exception as exc:
            yield _format_sse("error", {"detail": f"agent failed: {exc}"})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disable proxy buffering (e.g. nginx) so events flush immediately.
            "X-Accel-Buffering": "no",
        },
    )
