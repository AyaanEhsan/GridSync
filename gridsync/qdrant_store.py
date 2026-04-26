"""Thin wrapper around ``qdrant_client.QdrantClient`` for hybrid collections.

Convention used across GridSync:
- dense vector name:  ``"dense"``
- sparse vector name: ``"bm25"`` (with IDF modifier)

This keeps callers from re-stating the schema in every script/notebook.
"""

from __future__ import annotations

import os
import uuid
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from qdrant_client import QdrantClient, models

from gridsync.embeddings import SparseEmbedding


DENSE_VECTOR_NAME = "dense"
SPARSE_VECTOR_NAME = "bm25"


class QdrantStore:
    """High-level helper for a single hybrid Qdrant collection."""

    def __init__(
        self,
        url: str | None = None,
        api_key: str | None = None,
        collection: str | None = None,
        client: QdrantClient | None = None,
    ) -> None:
        if client is not None:
            self.client = client
        else:
            resolved_url = url or os.environ.get("QDRANT_URL")
            if not resolved_url:
                raise RuntimeError(
                    "QDRANT_URL is not set; pass url=... or export it."
                )
            self.client = QdrantClient(
                url=resolved_url,
                api_key=api_key or os.environ.get("QDRANT_API_KEY"),
            )

        resolved_collection = collection or os.environ.get("QDRANT_COLLECTION")
        if not resolved_collection:
            raise RuntimeError(
                "QDRANT_COLLECTION is not set; pass collection=... or export it."
            )
        self.collection = resolved_collection

    # ----- collection management -------------------------------------------------

    def exists(self) -> bool:
        return self.client.collection_exists(self.collection)

    def ensure_hybrid_collection(
        self,
        dense_size: int,
        distance: models.Distance = models.Distance.COSINE,
    ) -> None:
        """Create the hybrid collection (and required payload indexes) if they
        don't exist yet."""
        if not self.exists():
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config={
                    DENSE_VECTOR_NAME: models.VectorParams(
                        size=dense_size, distance=distance
                    ),
                },
                sparse_vectors_config={
                    SPARSE_VECTOR_NAME: models.SparseVectorParams(
                        modifier=models.Modifier.IDF
                    ),
                },
            )
        # Keyword index on "filename" is required for filtered count/scroll.
        # create_payload_index is idempotent — safe to call even if the index
        # already exists.
        self.client.create_payload_index(
            collection_name=self.collection,
            field_name="filename",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )

    def info(self):
        return self.client.get_collection(self.collection)

    # ----- writes ----------------------------------------------------------------

    @staticmethod
    def _to_sparse_vector(sparse: SparseEmbedding) -> models.SparseVector:
        return models.SparseVector(indices=sparse.indices, values=sparse.values)

    def upsert_hybrid(
        self,
        text: str,
        dense_vec: Sequence[float],
        sparse_vec: SparseEmbedding,
        metadata: Optional[Mapping[str, Any]] = None,
        point_id: Optional[str] = None,
    ) -> str:
        """Upsert a single document with its dense + sparse vectors."""
        pid = point_id or str(uuid.uuid4())
        payload: Dict[str, Any] = {"text": text, **(metadata or {})}
        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=pid,
                    vector={
                        DENSE_VECTOR_NAME: list(dense_vec),
                        SPARSE_VECTOR_NAME: self._to_sparse_vector(sparse_vec),
                    },
                    payload=payload,
                )
            ],
        )
        return pid

    def upsert_hybrid_batch(
        self,
        items: Iterable[
            tuple[str, Sequence[float], SparseEmbedding, Optional[Mapping[str, Any]]]
        ],
    ) -> List[str]:
        """Upsert multiple documents in a single request.

        Each item is ``(text, dense_vec, sparse_vec, metadata)``.
        """
        points: List[models.PointStruct] = []
        ids: List[str] = []
        for text, dense_vec, sparse_vec, metadata in items:
            pid = str(uuid.uuid4())
            ids.append(pid)
            points.append(
                models.PointStruct(
                    id=pid,
                    vector={
                        DENSE_VECTOR_NAME: list(dense_vec),
                        SPARSE_VECTOR_NAME: self._to_sparse_vector(sparse_vec),
                    },
                    payload={"text": text, **(metadata or {})},
                )
            )
        if points:
            self.client.upsert(collection_name=self.collection, points=points)
        return ids

    # ----- existence check -------------------------------------------------------

    def filename_exists(self, filename: str) -> bool:
        """Return True if at least one point with the given ``filename`` payload
        value already exists in the collection.

        Used by the ingestion pipeline to skip PDFs that have already been
        processed.
        """
        if not self.exists():
            return False
        # Ensure the keyword index exists — required by Qdrant cloud for
        # filtered counts. Idempotent, so safe to call on every check.
        self.client.create_payload_index(
            collection_name=self.collection,
            field_name="filename",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
        result = self.client.count(
            collection_name=self.collection,
            count_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="filename",
                        match=models.MatchValue(value=filename),
                    )
                ]
            ),
            exact=True,
        )
        return result.count > 0

    # ----- reads -----------------------------------------------------------------

    def query_dense(
        self,
        vector: Sequence[float],
        limit: int,
        query_filter: Optional[models.Filter] = None,
    ):
        return self.client.query_points(
            collection_name=self.collection,
            query=list(vector),
            using=DENSE_VECTOR_NAME,
            limit=limit,
            query_filter=query_filter,
            with_payload=True,
        ).points

    def query_sparse(
        self,
        sparse: SparseEmbedding,
        limit: int,
        query_filter: Optional[models.Filter] = None,
    ):
        return self.client.query_points(
            collection_name=self.collection,
            query=self._to_sparse_vector(sparse),
            using=SPARSE_VECTOR_NAME,
            limit=limit,
            query_filter=query_filter,
            with_payload=True,
        ).points
