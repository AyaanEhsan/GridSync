"""Thin wrapper around ``neo4j.GraphDatabase`` for the GridSync knowledge graph.

Provides a small, idempotent API for the operations we actually use:

- :meth:`Neo4jStore.create_node` – upsert a labelled entity by a unique key.
- :meth:`Neo4jStore.create_relationship` – upsert a directed edge between two
  existing entities.
- :meth:`Neo4jStore.query_based_on_file_id_and_chunk_no` – fetch the
  (from, rel, to) triples adjacent to a ``DocumentChunk`` identified by
  ``file_id`` + ``chunk_num``.

All writes use Cypher ``MERGE`` so re-running ingestion is safe.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Mapping, Optional

from neo4j import GraphDatabase, Driver


_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_identifier(value: str, kind: str) -> str:
    """Guard against Cypher injection via interpolated labels / rel types.

    Labels and relationship types cannot be parameterized in Cypher, so we
    splice them into the query string directly. Restrict them to plain
    identifiers (letters, digits, underscores; cannot start with a digit).
    """
    if not isinstance(value, str) or not _IDENT_RE.match(value):
        raise ValueError(
            f"Invalid {kind} {value!r}; must match {_IDENT_RE.pattern}"
        )
    return value


class Neo4jStore:
    """High-level helper around a single Neo4j database connection.

    The store owns a ``neo4j.Driver`` and exposes the small set of write/read
    helpers the rest of GridSync needs. It can be used as a context manager
    to ensure the underlying driver is closed::

        with Neo4jStore() as graph:
            graph.create_node("Event", {"name": "..."})
    """

    def __init__(
        self,
        uri: str | None = None,
        username: str | None = None,
        password: str | None = None,
        driver: Driver | None = None,
        verify_connectivity: bool = True,
    ) -> None:
        if driver is not None:
            self.driver = driver
        else:
            resolved_uri = uri or os.environ.get("NEO4J_URI")
            resolved_user = username or os.environ.get("NEO4J_USERNAME")
            resolved_password = password or os.environ.get("NEO4J_PASSWORD")
            missing = [
                name
                for name, val in (
                    ("NEO4J_URI", resolved_uri),
                    ("NEO4J_USERNAME", resolved_user),
                    ("NEO4J_PASSWORD", resolved_password),
                )
                if not val
            ]
            if missing:
                raise RuntimeError(
                    f"Missing Neo4j config: {', '.join(missing)}; "
                    "pass them explicitly or export the env vars."
                )
            self.driver = GraphDatabase.driver(
                resolved_uri, auth=(resolved_user, resolved_password)
            )

        if verify_connectivity:
            self.driver.verify_connectivity()

    # ----- lifecycle -------------------------------------------------------------

    def close(self) -> None:
        self.driver.close()

    def __enter__(self) -> "Neo4jStore":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    # ----- writes ----------------------------------------------------------------

    def create_node(
        self,
        label: str,
        properties: Mapping[str, Any],
        key: str = "name",
    ):
        """Create or update a single node in the knowledge graph (idempotent).

        The node is upserted using Cypher's ``MERGE`` on a unique ``key``
        property, so calling this method multiple times with the same
        ``key`` value will NOT create duplicates — additional properties are
        merged onto the existing node.

        Args:
            label: The node label (entity type), e.g. ``"Event"``,
                ``"Location"``, ``"Utility"``. Must be a plain identifier.
            properties: A mapping of properties to store on the node. MUST
                contain the ``key`` field (default ``"name"``) which uniquely
                identifies the node within its label.
            key: The property name used as the unique identifier for MERGE.
                Defaults to ``"name"``.

        Returns:
            The created/updated ``neo4j.graph.Node`` on success, or ``None``
            if no record was returned.

        Raises:
            KeyError: If ``properties`` does not contain ``key``.
            ValueError: If ``label`` or ``key`` is not a valid identifier.
        """
        _validate_identifier(label, "label")
        _validate_identifier(key, "key")
        if key not in properties:
            raise KeyError(
                f"properties must contain the unique key field {key!r}"
            )

        cypher = f"MERGE (n:{label} {{{key}: $kv}}) SET n += $props RETURN n"
        with self.driver.session() as session:
            rec = session.run(
                cypher, kv=properties[key], props=dict(properties)
            ).single()
            return rec["n"] if rec else None

    def create_relationship(
        self,
        from_label: str,
        from_key_value: Any,
        to_label: str,
        to_key_value: Any,
        rel_type: str,
        properties: Optional[Mapping[str, Any]] = None,
        key: str = "name",
    ):
        """Create or update a directed relationship between two nodes (idempotent).

        The edge is upserted with Cypher ``MERGE``, so re-running with the
        same endpoints and ``rel_type`` will NOT create duplicate edges.
        Supplied ``properties`` are merged onto the existing relationship.

        Direction is ``(from)-[REL]->(to)``; pick the direction that reads
        naturally as a sentence (e.g. ``(Utility)-[REPORTED]->(Event)``).

        Args:
            from_label: Label of the source node.
            from_key_value: Value of the unique ``key`` on the source node.
            to_label: Label of the target node.
            to_key_value: Value of the unique ``key`` on the target node.
            rel_type: Relationship type (edge label) in UPPER_SNAKE_CASE,
                e.g. ``"OCCURRED_AT"``, ``"REPORTED"``, ``"CAUSED_BY"``.
            properties: Optional attributes to attach to the edge itself.
            key: Property name used to look up both endpoints. Defaults to
                ``"name"``. Both endpoints must share the same lookup key.

        Returns:
            The created/updated ``neo4j.graph.Relationship`` on success, or
            ``None`` if either endpoint was not found.
        """
        _validate_identifier(from_label, "from_label")
        _validate_identifier(to_label, "to_label")
        _validate_identifier(rel_type, "rel_type")
        _validate_identifier(key, "key")

        cypher = (
            f"MATCH (a:{from_label} {{{key}: $from_kv}}), "
            f"(b:{to_label} {{{key}: $to_kv}}) "
            f"MERGE (a)-[r:{rel_type}]->(b) "
            f"SET r += $props RETURN r"
        )
        with self.driver.session() as session:
            rec = session.run(
                cypher,
                from_kv=from_key_value,
                to_kv=to_key_value,
                props=dict(properties or {}),
            ).single()
            return rec["r"] if rec else None

    # ----- reads -----------------------------------------------------------------

    # Ingestion stores `file_id` + `chunk_no` directly on the entity nodes
    # (e.g. ``Organization``, ``Threat``, ``Section``); there is no separate
    # ``DocumentChunk`` node. So "relationships adjacent to a chunk" means:
    # every directed edge whose source OR target is an entity that was
    # extracted from that chunk. ``chunk_no`` is stored as a string in the
    # graph, so callers should pass it as a string too.
    _CHUNK_NEIGHBORS_QUERY = (
        "MATCH (a)-[r]->(b) "
        "WHERE (a.file_id = $file_id AND a.chunk_no = $chunk_num) "
        "   OR (b.file_id = $file_id AND b.chunk_no = $chunk_num) "
        "RETURN labels(a)  AS from_labels, "
        "       a.name     AS from_name, "
        "       type(r)    AS relationship, "
        "       labels(b)  AS to_labels, "
        "       b.name     AS to_name"
    )

    def query_based_on_file_id_and_chunk_no(
        self,
        file_id: str,
        chunk_num: str,
    ) -> List[Dict[str, Any]]:
        """Return the relationships adjacent to entities extracted from a chunk.

        Ingestion writes ``file_id`` + ``chunk_no`` onto each entity node it
        creates (``Organization``, ``Threat``, ``Section``, ...), not onto a
        separate ``DocumentChunk`` node. This method returns one entry per
        directed edge where at least one endpoint was extracted from the
        given ``(file_id, chunk_num)`` chunk.

        Args:
            file_id: Value of the ``file_id`` property on the entity nodes
                (typically a UUID string shared by all entities from the
                same source PDF).
            chunk_num: Value of the ``chunk_no`` property. Stored as a
                string in the graph, e.g. ``"15"``; pass it as a string.

        Returns:
            A list of dicts shaped as ``{"from_node": [...labels...],
            "from_name": "...", "relationship": "REL_TYPE", "to_node":
            [...labels...], "to_name": "..."}``. Empty list if no entity
            for ``(file_id, chunk_num)`` participates in any relationship.
        """
        with self.driver.session() as session:
            records = session.run(
                self._CHUNK_NEIGHBORS_QUERY,
                file_id=file_id,
                chunk_num=chunk_num,
            )
            return [
                {
                    "from_node": list(r["from_labels"] or []),
                    "from_name": r["from_name"],
                    "relationship": r["relationship"],
                    "to_node": list(r["to_labels"] or []),
                    "to_name": r["to_name"],
                }
                for r in records
                if r["relationship"] is not None
            ]
