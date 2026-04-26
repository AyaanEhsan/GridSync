"""
run_pipeline.py
===============
Orchestrator: scans all three report folders, runs the full PDF pipeline on
every PDF, converts results into LangChain Document objects, and pushes them
to the Qdrant hybrid vector database using DenseEmbedder + SparseEmbedder.

Folder layout expected (relative to this file or to the repo root):
    data/
    ├── ero-reliability-risk-priorities-reports/   *.pdf
    ├── event_analysis_reports/                    *.pdf
    └── state_of_reliability_reports/              *.pdf

Usage
-----
    python run_pipeline.py                          # process all PDFs
    python run_pipeline.py --folders ero event     # only those two categories
    python run_pipeline.py --no-context            # skip Gemini (fast / offline)
    python run_pipeline.py --limit 2               # process at most 2 PDFs per folder (dev)
"""

from __future__ import annotations

import argparse
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.documents import Document
from tqdm.auto import tqdm

# ---------------------------------------------------------------------------
# Make the GridSync root importable so `gridsync` package resolves correctly
# regardless of where the script is launched from.
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parent.parent   # …/GridSync
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

for _env in [_REPO_ROOT / ".env", Path(".env"), Path("../.env")]:
    if _env.exists():
        load_dotenv(_env)
        break

from gridsync import DenseEmbedder, SparseEmbedder, QdrantStore, Neo4jStore  # noqa: E402
from pdf_pipeline import process_pdf                                          # noqa: E402
from graph_pipeline import generate_nodes_and_relationships                   # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FOLDER_NAMES = [
    "ero-reliability-risk-priorities-reports",
    "event_analysis_reports",
    "state_of_reliability_reports",
]

CANDIDATE_DATA_DIRS = [
    Path(__file__).parent / "data",
    Path("data_pipeline/data"),
    Path("data"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_data_dir() -> Path:
    for p in CANDIDATE_DATA_DIRS:
        if p.exists():
            return p
    raise FileNotFoundError(
        f"Could not find a data directory. Tried: {[str(p) for p in CANDIDATE_DATA_DIRS]}"
    )


def _collect_pdfs(data_dir: Path, folders: list[str], limit: int | None) -> list[Path]:
    """Return sorted list of PDF paths across all requested category folders."""
    pdfs: list[Path] = []
    for folder in folders:
        folder_path = data_dir / folder
        if not folder_path.exists():
            print(f"  [WARN] Folder not found, skipping: {folder_path}")
            continue
        found = sorted(folder_path.rglob("*.pdf"))
        if limit is not None:
            found = found[:limit]
        print(f"  {folder:45s} : {len(found)} PDF(s)")
        pdfs.extend(found)

    return pdfs


def records_to_documents(records: list[dict]) -> list[Document]:
    """Convert pdf_pipeline records into LangChain Document objects.

    Each Document has:
        page_content  – context + content (the string to embed)
        metadata      – folder, filename, file_id, chunk_no
    """
    return [
        Document(
            page_content=r["text"],
            metadata={
                "folder":   r["payload"]["folder"],
                "filename": r["payload"]["filename"],
                "file_id":  r["payload"]["file_id"],
                "chunk_no": r["payload"]["chunk_no"],
            },
        )
        for r in records
    ]


def push_documents_to_neo4j(
    documents: list[Document],
    graph: Neo4jStore,
    gemini_model: str | None = None,
    max_workers: int = 8,
) -> tuple[int, int]:
    """Extract entities/relationships from Documents and upsert them into Neo4j.

    Steps
    -----
    1. Send each Document's text to Gemini to extract nodes and relationships.
    2. Deduplicate across all chunks.
    3. Upsert every node via ``Neo4jStore.create_node``.
    4. Upsert every relationship via ``Neo4jStore.create_relationship``.

    Returns
    -------
    tuple[int, int]
        ``(nodes_upserted, relationships_upserted)``
    """
    if not documents:
        return 0, 0

    nodes, relationships = generate_nodes_and_relationships(
        documents, model=gemini_model, max_workers=max_workers
    )

    for node in nodes:
        graph.create_node(node["label"], node["properties"])

    for rel in relationships:
        graph.create_relationship(
            rel["from_label"], rel["from_key_value"],
            rel["to_label"],   rel["to_key_value"],
            rel["rel_type"],   rel.get("properties"),
        )

    return len(nodes), len(relationships)


def push_documents_to_qdrant(
    documents: list[Document],
    store: QdrantStore,
    dense_embedder: DenseEmbedder,
    sparse_embedder: SparseEmbedder,
) -> list[str]:
    """Embed and batch-upsert Documents into Qdrant.

    Steps
    -----
    1. Extract all ``page_content`` strings.
    2. Compute sparse (BM25) embeddings in one batched call.
    3. Compute dense (Gemini) embeddings one by one (API constraint).
    4. Ensure the hybrid collection exists.
    5. Upsert everything in a single network call via ``upsert_hybrid_batch``.

    Returns
    -------
    list[str]
        The Qdrant point IDs that were upserted.
    """
    if not documents:
        return []

    texts = [doc.page_content for doc in documents]

    print(f"    Embedding {len(texts)} chunk(s) — sparse (BM25)...")
    sparse_vecs = sparse_embedder.embed_many(texts)

    print(f"    Embedding {len(texts)} chunk(s) — dense (Gemini)...")
    dense_vecs = dense_embedder.embed_many(texts)

    # Ensure collection exists (uses first dense vector to get the dimension)
    store.ensure_hybrid_collection(dense_size=len(dense_vecs[0]))

    items = [
        (doc.page_content, dense_vecs[i], sparse_vecs[i], doc.metadata)
        for i, doc in enumerate(documents)
    ]

    print(f"    Upserting {len(items)} point(s) to Qdrant...")
    ids = store.upsert_hybrid_batch(items)
    return ids


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_pipeline(
    folders: list[str] | None = None,
    *,
    min_body_chars: int = 50,
    min_chunk_chars: int = 1000,
    max_doc_chars: int = 12_000,
    context_workers: int = 10,
    gemini_model: str | None = None,
    generate_context: bool = True,
    limit: int | None = None,
) -> None:
    """Run the full PDF → Qdrant pipeline across all (or selected) folders.

    Parameters
    ----------
    folders : list[str], optional
        Category folder names to process. Defaults to all three.
    min_body_chars : int
        Minimum raw chunk body size to keep (default 50).
    min_chunk_chars : int
        Minimum merged chunk size (default 1000).
    max_doc_chars : int
        Max doc chars sent to Gemini for context generation (default 12 000).
    context_workers : int
        Parallel Gemini threads per PDF (default 10).
    gemini_model : str, optional
        Gemini model override.
    generate_context : bool
        Set False to skip Gemini context calls (default True).
    limit : int, optional
        Max PDFs per folder — useful for dev/testing.
    """
    folders = folders or FOLDER_NAMES
    data_dir = _resolve_data_dir()

    print(f"\nData directory : {data_dir.resolve()}")
    print(f"Categories     : {folders}")
    print(f"Context gen    : {'yes' if generate_context else 'no (--no-context)'}\n")

    pdf_paths = _collect_pdfs(data_dir, folders, limit)
    if not pdf_paths:
        print("No PDFs found. Exiting.")
        return

    print(f"\nTotal PDFs to process: {len(pdf_paths)}\n{'=' * 70}\n")

    # Initialise shared resources once — avoids re-downloading BM25 model per PDF
    print("Initialising embedders and Qdrant store...")
    dense_embedder  = DenseEmbedder()
    sparse_embedder = SparseEmbedder()
    store           = QdrantStore()
    print(f"Connected to Qdrant collection: {store.collection}")

    print("Initialising Neo4j graph store...")
    graph = Neo4jStore()
    print("Connected to Neo4j.\n")

    total_chunks      = 0
    total_nodes       = 0
    total_rels        = 0
    failed: list[str] = []

    log_path = Path(__file__).parent / "ingestion.log"
    log_file = log_path.open("a", encoding="utf-8")
    log_file.write(
        f"\n{'=' * 70}\n"
        f"Run started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"{'=' * 70}\n"
    )
    log_file.flush()

    for pdf_path in tqdm(pdf_paths, desc="PDFs processed", unit="file"):
        print(f"\n{'─' * 70}")
        print(f">>> {pdf_path.relative_to(data_dir)}")

        if store.filename_exists(pdf_path.name):
            print(f"  [SKIP] '{pdf_path.name}' already ingested — found in Qdrant.")
            continue

        pdf_start = time.monotonic()
        try:
            # Step 1 – PDF → vector-DB records
            t0 = time.monotonic()
            records = process_pdf(
                pdf_path,
                min_body_chars=min_body_chars,
                min_chunk_chars=min_chunk_chars,
                max_doc_chars=max_doc_chars,
                context_workers=context_workers,
                gemini_model=gemini_model,
                generate_context=generate_context,
            )
            print(f"  [Step 1] PDF → records          : {time.monotonic() - t0:6.1f}s  ({len(records)} chunk(s))")

            # Step 2 – records → Document objects
            t0 = time.monotonic()
            documents = records_to_documents(records)
            print(f"  [Step 2] records → Documents    : {time.monotonic() - t0:6.1f}s  ({len(documents)} doc(s))")

            # Step 3 – embed + upsert to Qdrant
            t0 = time.monotonic()
            ids = push_documents_to_qdrant(
                documents, store, dense_embedder, sparse_embedder
            )
            print(f"  [Step 3] Qdrant upsert          : {time.monotonic() - t0:6.1f}s  ({len(ids)} point(s) upserted)")

            # Step 4 – extract entities/relationships and upsert to Neo4j
            t0 = time.monotonic()
            n_nodes, n_rels = push_documents_to_neo4j(
                documents, graph,
                gemini_model=gemini_model,
                max_workers=context_workers,
            )
            print(f"  [Step 4] Neo4j graph upsert     : {time.monotonic() - t0:6.1f}s  ({n_nodes} node(s), {n_rels} relationship(s))")

            pdf_elapsed = time.monotonic() - pdf_start
            total_chunks += len(ids)
            total_nodes  += n_nodes
            total_rels   += n_rels
            print(
                f"\n  ✅ SUCCESS — '{pdf_path.name}' fully ingested in {pdf_elapsed:.1f}s\n"
                f"     Qdrant : {len(ids)} chunk(s) upserted\n"
                f"     Neo4j  : {n_nodes} node(s) + {n_rels} relationship(s) upserted"
            )
            log_file.write(
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SUCCESS  "
                f"{pdf_path.name}  |  "
                f"{pdf_elapsed:.1f}s  |  "
                f"Qdrant: {len(ids)} chunk(s)  |  "
                f"Neo4j: {n_nodes} node(s) + {n_rels} rel(s)\n"
            )
            log_file.flush()

        except Exception:
            failed.append(str(pdf_path))
            print(f"  [ERROR] Failed to process {pdf_path.name}:")
            traceback.print_exc()
            log_file.write(
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] FAILED   "
                f"{pdf_path.name}\n"
            )
            log_file.flush()

    graph.close()

    summary = (
        f"\nRun finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  |  "
        f"{len(pdf_paths) - len(failed)}/{len(pdf_paths)} succeeded  |  "
        f"Chunks: {total_chunks}  |  Nodes: {total_nodes}  |  Edges: {total_rels}\n"
    )
    log_file.write(summary)
    log_file.close()
    print(f"  Log written to: {log_path.resolve()}")

    print(f"\n{'=' * 70}")
    print(f"  Finished  |  {len(pdf_paths) - len(failed)}/{len(pdf_paths)} PDF(s) succeeded")
    print(f"  Chunks upserted (Qdrant) : {total_chunks}")
    print(f"  Nodes upserted  (Neo4j)  : {total_nodes}")
    print(f"  Edges upserted  (Neo4j)  : {total_rels}")
    if failed:
        print(f"  Failed files:")
        for f in failed:
            print(f"    - {f}")
    print(f"{'=' * 70}\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

_FOLDER_ALIASES = {
    "ero":   "ero-reliability-risk-priorities-reports",
    "event": "event_analysis_reports",
    "sor":   "state_of_reliability_reports",
}


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Run the PDF pipeline and push chunks to Qdrant.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--folders", nargs="+", default=None, metavar="FOLDER",
        help="Categories to process: ero, event, sor (or full folder names). Default: all.",
    )
    p.add_argument("--min-body",   type=int, default=50,     metavar="N",
                   help="Min raw chunk body chars to keep")
    p.add_argument("--min-chars",  type=int, default=1000,   metavar="N",
                   help="Min merged chunk body chars")
    p.add_argument("--max-doc",    type=int, default=12_000, metavar="N",
                   help="Max doc chars sent to Gemini")
    p.add_argument("--workers",    type=int, default=10,     metavar="N",
                   help="Parallel Gemini threads per PDF")
    p.add_argument("--model",      type=str, default=None,
                   help="Gemini model override")
    p.add_argument("--no-context", action="store_true",
                   help="Skip Gemini context generation")
    p.add_argument("--limit",      type=int, default=None,   metavar="N",
                   help="Max PDFs per folder (useful for testing)")
    return p


if __name__ == "__main__":
    args    = _build_parser().parse_args()
    folders = [_FOLDER_ALIASES.get(f, f) for f in args.folders] if args.folders else None

    run_pipeline(
        folders=folders,
        min_body_chars=args.min_body,
        min_chunk_chars=args.min_chars,
        max_doc_chars=args.max_doc,
        context_workers=args.workers,
        gemini_model=args.model,
        generate_context=not args.no_context,
        limit=args.limit,
    )
