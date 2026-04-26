"""GridSync shared library.

Reusable building blocks for hybrid (dense + sparse) retrieval over Qdrant.
Used by both the data pipeline (ingestion notebooks/scripts) and the backend
RAG layer.
"""

from gridsync.embeddings import DenseEmbedder, SparseEmbedder
from gridsync.qdrant_store import QdrantStore
from gridsync.hybrid_search import HybridHit, hybrid_search

__all__ = [
    "DenseEmbedder",
    "SparseEmbedder",
    "QdrantStore",
    "HybridHit",
    "hybrid_search",
]
