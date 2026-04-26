"""Hybrid retrieval (dense + sparse) over a ``QdrantStore``.

Scores from each branch are min-max normalized to ``[0, 1]`` and then combined
linearly: ``final = dense_weight * dense_norm + sparse_weight * sparse_norm``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from qdrant_client import models

from gridsync.embeddings import DenseEmbedder, SparseEmbedder
from gridsync.qdrant_store import QdrantStore


@dataclass
class HybridHit:
    id: Any
    score: float
    dense_score: Optional[float]
    sparse_score: Optional[float]
    payload: Optional[Dict[str, Any]]


def _minmax(hits) -> Dict[Any, float]:
    if not hits:
        return {}
    scores = [h.score for h in hits]
    lo, hi = min(scores), max(scores)
    rng = (hi - lo) or 1.0
    return {h.id: (h.score - lo) / rng for h in hits}


def hybrid_search(
    store: QdrantStore,
    dense_embedder: DenseEmbedder,
    sparse_embedder: SparseEmbedder,
    query_text: str,
    top_k: int = 5,
    dense_weight: float = 0.5,
    sparse_weight: float = 0.5,
    candidate_k: int = 50,
    query_filter: Optional[models.Filter] = None,
) -> List[HybridHit]:
    """Run a hybrid dense+sparse search and return ``top_k`` fused hits."""
    if abs((dense_weight + sparse_weight) - 1.0) >= 1e-6:
        raise ValueError("dense_weight + sparse_weight must equal 1.0")

    q_dense = dense_embedder.embed(query_text)
    q_sparse = sparse_embedder.embed(query_text)

    dense_hits = store.query_dense(q_dense, limit=candidate_k, query_filter=query_filter)
    sparse_hits = store.query_sparse(q_sparse, limit=candidate_k, query_filter=query_filter)

    dense_norm = _minmax(dense_hits)
    sparse_norm = _minmax(sparse_hits)

    payloads: Dict[Any, Dict[str, Any]] = {h.id: h.payload for h in dense_hits}
    payloads.update({h.id: h.payload for h in sparse_hits})

    fused: Dict[Any, float] = {}
    for pid in set(dense_norm) | set(sparse_norm):
        fused[pid] = (
            dense_weight * dense_norm.get(pid, 0.0)
            + sparse_weight * sparse_norm.get(pid, 0.0)
        )

    ranked = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)[:top_k]

    return [
        HybridHit(
            id=pid,
            score=score,
            dense_score=dense_norm.get(pid),
            sparse_score=sparse_norm.get(pid),
            payload=payloads.get(pid),
        )
        for pid, score in ranked
    ]
