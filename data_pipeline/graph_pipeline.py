"""
graph_pipeline.py
=================
LLM-powered entity/relationship extractor for the GridSync knowledge graph.

Processes a list of LangChain Document objects, sends each chunk to Gemini
with a structured JSON prompt, and returns node + relationship dicts that are
directly consumable by ``Neo4jStore.create_node`` / ``Neo4jStore.create_relationship``.

Usage
-----
    from graph_pipeline import generate_nodes_and_relationships
    from gridsync.neo4j_store import Neo4jStore

    nodes, relationships = generate_nodes_and_relationships(documents)

    with Neo4jStore() as graph:
        for n in nodes:
            graph.create_node(n["label"], n["properties"])
        for r in relationships:
            graph.create_relationship(
                r["from_label"], r["from_key_value"],
                r["to_label"],   r["to_key_value"],
                r["rel_type"],   r.get("properties"),
            )
"""

from __future__ import annotations

import json
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from google import genai as google_genai
from langchain_core.documents import Document
from tqdm.auto import tqdm

for _env_path in [Path(".env"), Path("../.env"), Path(__file__).parent.parent / ".env"]:
    if _env_path.exists():
        load_dotenv(_env_path)
        break


# ---------------------------------------------------------------------------
# Identifier sanitisation
# ---------------------------------------------------------------------------

def _to_identifier(value: str) -> str:
    """Convert an arbitrary LLM-returned string to a valid Neo4j identifier.

    Neo4j labels and relationship types must match ``^[A-Za-z_][A-Za-z0-9_]*$``.
    Steps:
      1. Replace spaces, hyphens, dots and other non-word chars with underscores.
      2. Strip any characters that still don't match [A-Za-z0-9_].
      3. If the result starts with a digit, prepend an underscore.
      4. Return empty string if nothing survives (caller will skip the entry).
    """
    s = re.sub(r"[\s\-\.]+", "_", value.strip())   # spaces/hyphens/dots → _
    s = re.sub(r"[^A-Za-z0-9_]", "", s)            # drop everything else
    s = re.sub(r"_+", "_", s).strip("_")            # collapse repeated underscores
    if s and s[0].isdigit():
        s = "_" + s
    return s


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_EXTRACT_PROMPT = """\
You are a knowledge graph extraction assistant.

Read the text chunk below and extract every named entity and every relationship \
between entities. Return ONLY a valid JSON object with this exact structure:

{{
  "nodes": [
    {{
      "label": "<EntityType>",
      "name":  "<unique canonical name of the entity>",
      "properties": {{
        "<extra_key>": "<extra_value>"
      }}
    }}
  ],
  "relationships": [
    {{
      "from_label": "<EntityType of the source node>",
      "from_name":  "<name of the source entity>",
      "to_label":   "<EntityType of the target node>",
      "to_name":    "<name of the target entity>",
      "rel_type":   "<RELATIONSHIP_TYPE>",
      "properties": {{}}
    }}
  ]
}}

--- Schema rules (read carefully) ---

Node label ("label"):
  • Choose a short noun that describes the entity type, e.g. Event, Location,
    Organization, Person, Technology, Policy, Risk, Standard, Report, Region.
  • Must be a plain identifier: letters, digits, underscores only; cannot start
    with a digit.  Good: "RiskPriority".  Bad: "risk-priority", "2Event".

Node name ("name"):
  • The unique key that identifies this entity within its label.  It is used
    to MERGE (upsert) the node, so the same real-world entity must always get
    exactly the same name string across all chunks.
  • Keep it concise and canonical — pick one form and stick to it
    (e.g. always "ERCOT", never mix "ERCOT" and "Electric Reliability Council
    of Texas" in the same output).

Node properties ("properties"):
  • Optional scalar attributes you can confidently infer from the text
    (e.g. year, description, standard_code).
  • Do NOT include "name" here; it is already the top-level key.

Relationship type ("rel_type"):
  • Describe the directed edge from source → target as a verb phrase in
    UPPER_SNAKE_CASE, e.g. OCCURRED_AT, CAUSED_BY, REPORTED_BY, PART_OF,
    OWNED_BY, REFERENCES, MITIGATES, ASSOCIATED_WITH.
  • Direction should read naturally as a sentence:
    (Organization)-[REPORTED]->(Event), (Event)-[OCCURRED_AT]->(Location).

General rules:
  • If a relationship references an entity that is not yet in the nodes list,
    add it.
  • Only extract entities and relationships that are explicitly stated or very
    strongly implied — precision over recall.
  • Output ONLY the JSON object, no markdown fences, no preamble, no commentary.

<chunk>
{chunk_text}
</chunk>
"""

# Maximum characters sent per chunk to avoid token limits
_MAX_CHUNK_CHARS = 6_000


# ---------------------------------------------------------------------------
# Thread-local Gemini client
# ---------------------------------------------------------------------------

_local = threading.local()


def _get_client(api_key: str) -> google_genai.Client:
    if not hasattr(_local, "client"):
        _local.client = google_genai.Client(api_key=api_key)
    return _local.client


# ---------------------------------------------------------------------------
# Per-chunk extraction
# ---------------------------------------------------------------------------

def _extract_from_chunk(
    chunk_text: str,
    model: str,
    api_key: str,
    file_id: str = "",
    chunk_no: int = 0,
) -> tuple[list[dict], list[dict]]:
    """Send one text chunk to Gemini and return (nodes, relationships).

    Uses JSON response mode so the output is always parseable. Falls back to
    empty lists on any error rather than crashing the whole pipeline.

    ``file_id`` and ``chunk_no`` are injected into every extracted node's
    ``properties`` so each graph node can be traced back to its source vector
    chunk in Qdrant.
    """
    prompt = _EXTRACT_PROMPT.format(chunk_text=chunk_text[:_MAX_CHUNK_CHARS])
    try:
        resp = _get_client(api_key).models.generate_content(
            model=model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0,
            },
        )
        data = json.loads(resp.text.strip())
        nodes = data.get("nodes", [])
        rels  = data.get("relationships", [])

        # Tag every node with the source chunk so the graph can be linked back
        # to its corresponding vector in Qdrant.
        for node in nodes:
            props = node.setdefault("properties", {})
            props["file_id"]  = str(file_id)
            props["chunk_no"] = str(chunk_no)

        return nodes, rels
    except Exception as exc:
        print(f"  [WARN] graph extraction failed for chunk: {exc}")
        return [], []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_nodes_and_relationships(
    documents: list[Document],
    *,
    model: str | None = None,
    max_workers: int = 20,
) -> tuple[list[dict], list[dict]]:
    """Extract knowledge-graph triples from a list of LangChain Documents.

    Each Document's ``page_content`` is sent to Gemini which returns a
    structured JSON object with nodes and relationships. Results from all
    chunks are merged and deduplicated before being returned.

    Parameters
    ----------
    documents : list[Document]
        Output of ``records_to_documents()`` in ``run_pipeline.py``.
    model : str, optional
        Gemini model ID. Defaults to ``GEMINI_MODEL`` env var or
        ``gemini-2.5-flash``.
    max_workers : int
        Parallel Gemini threads (default 8).

    Returns
    -------
    nodes : list[dict]
        Each dict has ``"label"`` and ``"properties"`` (which always includes
        ``"name"``). Ready for::

            graph.create_node(n["label"], n["properties"])

    relationships : list[dict]
        Each dict has ``"from_label"``, ``"from_key_value"``, ``"to_label"``,
        ``"to_key_value"``, ``"rel_type"``, and ``"properties"``. Ready for::

            graph.create_relationship(**r)
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set — check your .env file.")

    model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    all_nodes: list[dict] = []
    all_rels:  list[dict] = []

    def _process(doc: Document) -> tuple[list[dict], list[dict]]:
        meta = doc.metadata or {}
        return _extract_from_chunk(
            doc.page_content,
            model,
            api_key,
            file_id=meta.get("file_id", ""),
            chunk_no=int(meta.get("chunk_no", 0)),
        )

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_process, doc): doc for doc in documents}
        for future in tqdm(
            as_completed(futures),
            total=len(futures),
            desc="Extracting graph triples",
        ):
            nodes, rels = future.result()
            all_nodes.extend(nodes)
            all_rels.extend(rels)

    # --- deduplicate nodes by (label, name) ----------------------------------
    seen_nodes: set[tuple[str, str]] = set()
    unique_nodes: list[dict] = []
    for node in all_nodes:
        label = _to_identifier(str(node.get("label", "")))
        name  = str(node.get("name", "")).strip()
        if not label or not name:
            continue
        key = (label, name.lower())
        if key in seen_nodes:
            continue
        seen_nodes.add(key)
        props = dict(node.get("properties", {}))
        props["name"] = name                 # ensure "name" is always present
        unique_nodes.append({"label": label, "properties": props})

    # --- normalise relationships into Neo4jStore format ----------------------
    seen_rels: set[tuple] = set()
    norm_rels: list[dict] = []
    for rel in all_rels:
        from_label = _to_identifier(str(rel.get("from_label", "")))
        from_name  = str(rel.get("from_name",  "")).strip()
        to_label   = _to_identifier(str(rel.get("to_label",   "")))
        to_name    = str(rel.get("to_name",    "")).strip()
        rel_type   = _to_identifier(str(rel.get("rel_type",   "")).upper())
        rel_props  = rel.get("properties", {}) or {}

        if not all([from_label, from_name, to_label, to_name, rel_type]):
            continue

        dedup_key = (from_label, from_name.lower(), to_label, to_name.lower(), rel_type)
        if dedup_key in seen_rels:
            continue
        seen_rels.add(dedup_key)

        norm_rels.append({
            "from_label":     from_label,
            "from_key_value": from_name,
            "to_label":       to_label,
            "to_key_value":   to_name,
            "rel_type":       rel_type,
            "properties":     rel_props,
        })

    print(
        f"  Graph extraction complete: "
        f"{len(unique_nodes)} unique node(s), {len(norm_rels)} relationship(s)"
    )
    return unique_nodes, norm_rels
