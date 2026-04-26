from functools import lru_cache

from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    AgentToolCall,
    Chunk,
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
        
    return SearchResponse(query=req.query, chunks=chunks)


@router.post("/agent/dummy", response_model=AgentChatResponse, tags=["agent"])
def agent_dummy_chat(req: AgentChatRequest) -> AgentChatResponse:
    """Smoke-test endpoint for a dummy LangChain agent backed by Gemini.

    Sends ``req.message`` to a minimal ``create_agent`` agent that has a single
    in-process ``get_current_time`` tool. Returns the agent's final reply and
    any tool calls it made along the way.
    """
    from app.agents.dummy_agent import get_dummy_agent

    try:
        agent = get_dummy_agent()
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
