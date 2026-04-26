"""Hybrid retrieval (dense + sparse) over a ``QdrantStore`` with mandatory
Cohere reranking.

Stage 1 (retrieve + fuse): scores from the dense and sparse branches are
min-max normalized to ``[0, 1]`` and combined linearly:
``fused = dense_weight * dense_norm + sparse_weight * sparse_norm``.

Stage 2 (rerank): the top fused candidates -- by default ``top_k +
rerank_pool`` of them, e.g. ``5 + 100 = 105`` for ``top_k=5`` -- are sent to
Cohere's rerank API and the final ``top_k`` is selected by Cohere's
relevance score. Reranking is always on; if it fails the call raises.

The Cohere call uses ``COHERE_API_KEY`` and ``COHERE_RERANKER_MODEL``
(default ``rerank-v3.5``) from the environment / project ``.env``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, List, Optional, Sequence, Tuple

from qdrant_client import models

from gridsync.embeddings import DenseEmbedder, SparseEmbedder
from gridsync.qdrant_store import QdrantStore


@dataclass
class HybridHit:
    id: Any
    score: float
    dense_score: Optional[float]
    sparse_score: Optional[float]
    rerank_score: float
    payload: Optional[Dict[str, Any]]


def _minmax(hits) -> Dict[Any, float]:
    if not hits:
        return {}
    scores = [h.score for h in hits]
    lo, hi = min(scores), max(scores)
    rng = (hi - lo) or 1.0
    return {h.id: (h.score - lo) / rng for h in hits}


@lru_cache(maxsize=1)
def _get_cohere_client():
    """Lazy-init a single Cohere ClientV2 per process."""
    import cohere

    api_key = os.environ.get("COHERE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "COHERE_API_KEY is not set in the environment / .env"
        )
    return cohere.ClientV2(api_key=api_key)


def _cohere_rerank(
    query: str,
    documents: Sequence[str],
    top_n: int,
    model: Optional[str] = None,
) -> List[Tuple[int, float]]:
    """Call Cohere rerank and return ``[(index, relevance_score), ...]``."""
    client = _get_cohere_client()
    model_name = model or os.environ.get("COHERE_RERANKER_MODEL", "rerank-v3.5")

    resp = client.rerank(
        model=model_name,
        query=query,
        documents=list(documents),
        top_n=min(top_n, len(documents)),
    )
    return [(r.index, float(r.relevance_score)) for r in resp.results]

def hybrid_search(
    store: QdrantStore,
    dense_embedder: DenseEmbedder,
    sparse_embedder: SparseEmbedder,
    query_text: str,
    top_k: int = 5,
    dense_weight: float = 0.5,
    sparse_weight: float = 0.5,
    candidate_k: Optional[int] = None,
    rerank_pool: int = 100,
    rerank_text_field: str = "text",
    cohere_model: Optional[str] = None,
    query_filter: Optional[models.Filter] = None,
) -> List[HybridHit]:
    """Hybrid dense+sparse search, always re-ranked with Cohere.

    The dense and sparse branches each pull ``top_k + rerank_pool`` candidates
    (e.g. ``105`` when ``top_k=5``), they get fused, then the fused pool is
    sent to Cohere's rerank API and the final ``top_k`` is selected by
    Cohere's relevance score. ``candidate_k`` overrides the per-branch limit.
    """
    if abs((dense_weight + sparse_weight) - 1.0) >= 1e-6:
        raise ValueError("dense_weight + sparse_weight must equal 1.0")
    if top_k <= 0:
        raise ValueError("top_k must be >= 1")
    if rerank_pool < 0:
        raise ValueError("rerank_pool must be >= 0")

    if candidate_k is None:
        candidate_k = top_k + rerank_pool

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

    ranked = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)

    pool = ranked[: max(top_k + rerank_pool, top_k)]

    pool_with_text = [
        (pid, fused_score, (payloads.get(pid) or {}).get(rerank_text_field) or "")
        for pid, fused_score in pool
    ]
    rerankable = [(pid, fs, txt) for pid, fs, txt in pool_with_text if txt]

    if not rerankable:
        raise RuntimeError(
            "Cohere rerank requires document text, but none of the "
            f"{len(pool)} fused candidates have a non-empty "
            f"'{rerank_text_field}' payload field."
        )

    docs = [txt for _, _, txt in rerankable]
    rerank_results = _cohere_rerank(
        query=query_text,
        documents=docs,
        top_n=top_k,
        model=cohere_model,
    )

    model_name = cohere_model or os.environ.get("COHERE_RERANKER_MODEL", "rerank-v3.5")
    print(
        f"[cohere-rerank] query={query_text!r} model={model_name} "
        f"pool_size={len(rerankable)} returning_top={len(rerank_results)}",
        flush=True,
    )
    print(
        f"[cohere-rerank] {'rank':<5}{'id':<40}"
        f"{'rerank':>10}{'fused':>10}{'dense':>10}{'sparse':>10}  preview",
        flush=True,
    )

    final: List[HybridHit] = []
    for rank, (idx, rel) in enumerate(rerank_results, start=1):
        pid, fused_score, txt = rerankable[idx]
        preview = " ".join(txt.split())[:80]
        print(
            f"[cohere-rerank] {rank:<5}{str(pid):<40}"
            f"{rel:>10.4f}{fused_score:>10.4f}"
            f"{(dense_norm.get(pid) or 0.0):>10.4f}"
            f"{(sparse_norm.get(pid) or 0.0):>10.4f}  {preview}",
            flush=True,
        )
        final.append(
            HybridHit(
                id=pid,
                score=rel,
                dense_score=dense_norm.get(pid),
                sparse_score=sparse_norm.get(pid),
                rerank_score=rel,
                payload=payloads.get(pid),
            )
        )

    return final
