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

    _CHUNK_NEIGHBORS_QUERY = (
        "MATCH (c:DocumentChunk {file_id: $file_id, chunk_no: $chunk_num}) "
        "OPTIONAL MATCH path = (c)-[r]-(n) "
        "RETURN collect({"
        "from_node: labels(c), "
        "relationship: type(r), "
        "to_node: labels(n)"
        "}) AS node_relation_node"
    )

    def query_based_on_file_id_and_chunk_no(
        self,
        file_id: str,
        chunk_num: str,
    ) -> List[Dict[str, Any]]:
        """Return the relationships adjacent to a single ``DocumentChunk``.

        Looks up the ``DocumentChunk`` node identified by ``file_id`` +
        ``chunk_num`` and returns one entry per incident edge, each shaped
        as ``{"from_node": [...labels...], "relationship": "REL_TYPE",
        "to_node": [...labels...]}``.

        Args:
            file_id: Value of the ``file_id`` property on the chunk node
                (typically a UUID string).
            chunk_num: Value of the ``chunk_no`` property on the chunk node
                (stored as a string in the graph, e.g. ``"1"``).

        Returns:
            A list of ``{from_node, relationship, to_node}`` dicts. Empty
            list if the chunk does not exist or has no relationships.
        """
        with self.driver.session() as session:
            record = session.run(
                self._CHUNK_NEIGHBORS_QUERY,
                file_id=file_id,
                chunk_num=chunk_num,
            ).single()
            if record is None:
                return []
            triples = record["node_relation_node"] or []
            return [t for t in triples if t.get("relationship") is not None]
