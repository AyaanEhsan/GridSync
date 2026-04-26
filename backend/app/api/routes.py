from functools import lru_cache

from fastapi import APIRouter, HTTPException

from app.api.schemas import (
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


@router.post("/search", response_model=SearchResponse, tags=["rag"])
def search(req: SearchRequest) -> SearchResponse:
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
                text=text,
                metadata=payload,
            )
        )
    return SearchResponse(query=req.query, chunks=chunks)
