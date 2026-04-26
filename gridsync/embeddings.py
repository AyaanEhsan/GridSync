"""Dense and sparse text embedding clients.

- ``DenseEmbedder`` wraps Google Gemini ``gemini-embedding-001``.
- ``SparseEmbedder`` wraps FastEmbed's ``Qdrant/bm25`` model.

Both are intentionally lightweight wrappers so the rest of the codebase can
swap models without touching call sites.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable, List, Sequence


DEFAULT_DENSE_MODEL = "gemini-embedding-001"
DEFAULT_SPARSE_MODEL = "Qdrant/bm25"


@dataclass(frozen=True)
class SparseEmbedding:
    """Indices/values pair for a sparse embedding."""

    indices: List[int]
    values: List[float]


class DenseEmbedder:
    """Gemini-backed dense embedder.

    Lazily creates a single ``genai.Client``. Reads ``GEMINI_API_KEY`` from the
    environment unless ``api_key`` is supplied.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_DENSE_MODEL,
    ) -> None:
        from google import genai  # local import to keep import cost low

        resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not resolved_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set; pass api_key=... or export it."
            )

        self._client = genai.Client(api_key=resolved_key)
        self.model = model

    def embed(self, text: str) -> List[float]:
        """Embed a single string and return the dense vector."""
        response = self._client.models.embed_content(
            model=self.model,
            contents=text,
        )
        return list(response.embeddings[0].values)

    def embed_many(self, texts: Sequence[str]) -> List[List[float]]:
        """Embed multiple strings; returns a list of vectors in input order."""
        return [self.embed(t) for t in texts]


class SparseEmbedder:
    """FastEmbed BM25 sparse embedder."""

    def __init__(self, model_name: str = DEFAULT_SPARSE_MODEL) -> None:
        from fastembed import SparseTextEmbedding  # local import

        self.model_name = model_name
        self._model = SparseTextEmbedding(model_name=model_name)

    def embed(self, text: str) -> SparseEmbedding:
        raw = next(self._model.embed([text]))
        return SparseEmbedding(
            indices=raw.indices.tolist(),
            values=raw.values.tolist(),
        )

    def embed_many(self, texts: Iterable[str]) -> List[SparseEmbedding]:
        return [
            SparseEmbedding(indices=raw.indices.tolist(), values=raw.values.tolist())
            for raw in self._model.embed(list(texts))
        ]
