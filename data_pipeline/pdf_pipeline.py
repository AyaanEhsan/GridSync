"""
pdf_pipeline.py
===============
End-to-end PDF → vector-DB-ready chunk pipeline.

Usage
-----
As a library::

    from pdf_pipeline import process_pdf

    records = process_pdf("data/ero-reliability-risk-priorities-reports/report.pdf")
    # records is a list[dict] ready to upsert into Qdrant (or any vector DB)

As a CLI::

    python pdf_pipeline.py path/to/report.pdf
    python pdf_pipeline.py path/to/report.pdf --min-chars 1500 --workers 8 --out chunks.json

Output schema (one dict per chunk)
-----------------------------------
{
    "id"      : str          # unique UUID per chunk  → Qdrant point id
    "text"    : str          # context + content      → text to embed
    "payload" : {
        "context"   : str    # Gemini-generated situating context
        "content"   : str    # raw chunk text (header + body)
        "title"     : str    # plain-text section title
        "level"     : int    # markdown heading depth (0 = preamble)
        "folder"    : str    # category subfolder name
        "filename"  : str    # PDF filename
        "file_id"   : str    # UUID shared across all chunks of this file
        "chunk_no"  : int    # 0-based index within this file
    }
}
"""

from __future__ import annotations

import argparse
import json
import os
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pymupdf4llm
from dotenv import load_dotenv
from google import genai as google_genai
from tqdm.auto import tqdm

# ---------------------------------------------------------------------------
# .env loading
# ---------------------------------------------------------------------------

for _env_path in [Path(".env"), Path("../.env"), Path(__file__).parent.parent / ".env"]:
    if _env_path.exists():
        load_dotenv(_env_path)
        break

# ---------------------------------------------------------------------------
# Step 1 – PDF → cleaned markdown
# ---------------------------------------------------------------------------

_PICTURE_RE = re.compile(
    # Picture-omission line (** bold optional, any WxH dimensions)
    r"^\**==> picture \[\d+ x \d+\] intentionally omitted <==\**\n?"
    # Start-of-picture-text marker line only
    r"|^\**-{5} Start of picture text -{5}\**<br>\n?"
    # End-of-picture-text marker (may appear mid-line)
    r"|\**-{5} End of picture text -{5}\**<br>",
    re.IGNORECASE | re.MULTILINE,
)


def _clean_text(text: str) -> str:
    """Remove pymupdf4llm image-placeholder markers and tidy whitespace."""
    text = _PICTURE_RE.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pdf_to_markdown(pdf_path: str | Path) -> str:
    """Convert a PDF file to cleaned markdown text via pymupdf4llm."""
    return _clean_text(pymupdf4llm.to_markdown(str(pdf_path)))


# ---------------------------------------------------------------------------
# Step 2 – markdown → header-based chunks
# ---------------------------------------------------------------------------

_HEADER_RE  = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
_MD_BOLD_RE = re.compile(r"\*{1,2}(.+?)\*{1,2}")


def chunk_by_headers(
    md_text: str,
    source: str = "",
    min_body_chars: int = 0,
) -> list[dict]:
    """Split cleaned markdown into one chunk per header section.

    Parameters
    ----------
    md_text : str
        Cleaned markdown string.
    source : str
        Source label stored on every chunk (e.g. filename).
    min_body_chars : int
        Drop chunks whose body is shorter than this (default 0 = keep all).

    Returns
    -------
    list[dict]  – keys: chunk_index, level, header, title, body, content, source
    """
    matches = list(_HEADER_RE.finditer(md_text))
    chunks: list[dict] = []

    def _plain(t: str) -> str:
        return _MD_BOLD_RE.sub(r"\1", t).strip()

    def _make(level, raw_hdr, title, body, source):
        body = body.strip()
        if len(body) < min_body_chars:
            return None
        return {
            "chunk_index": len(chunks),
            "level":       level,
            "header":      raw_hdr,
            "title":       title,
            "body":        body,
            "content":     (raw_hdr + "\n" + body).strip() if raw_hdr else body,
            "source":      source,
        }

    preamble = md_text[: matches[0].start()].strip() if matches else md_text.strip()
    if preamble:
        c = _make(0, "", "(Preamble)", preamble, source)
        if c:
            chunks.append(c)

    for i, m in enumerate(matches):
        level   = len(m.group(1))
        raw_hdr = m.group(0)
        title   = _plain(m.group(2))
        b_start = m.end()
        b_end   = matches[i + 1].start() if i + 1 < len(matches) else len(md_text)
        body    = md_text[b_start:b_end]
        c = _make(level, raw_hdr, title, body, source)
        if c:
            chunks.append(c)

    return chunks


# ---------------------------------------------------------------------------
# Step 3 – merge chunks smaller than min_chars
# ---------------------------------------------------------------------------

def merge_small_chunks(chunks: list[dict], min_chars: int = 1000) -> list[dict]:
    """Merge consecutive chunks until body length reaches *min_chars*.

    Parameters
    ----------
    chunks : list[dict]
        Output of ``chunk_by_headers()``.
    min_chars : int
        Minimum accumulated body chars before a group is flushed (default 1000).

    Returns
    -------
    list[dict]  – re-indexed from 0.
    """
    if not chunks:
        return []

    merged: list[dict] = []
    group: list[dict]  = []
    running = 0

    def _flush(group: list[dict]) -> dict:
        first   = group[0]
        title   = " | ".join(c["title"]   for c in group if c["title"])
        body    = "\n\n".join(c["body"]    for c in group if c["body"])
        content = "\n\n".join(c["content"] for c in group if c["content"])
        return {
            "chunk_index": len(merged),
            "level":       first["level"],
            "header":      first["header"],
            "title":       title,
            "body":        body,
            "content":     content,
            "source":      first["source"],
        }

    for chunk in chunks:
        group.append(chunk)
        running += len(chunk["body"])
        if running >= min_chars:
            merged.append(_flush(group))
            group, running = [], 0

    if group:
        merged.append(_flush(group))

    return merged


# ---------------------------------------------------------------------------
# Step 4 – generate contextual summaries via Gemini (parallel threads)
# ---------------------------------------------------------------------------

_CONTEXT_PROMPT = """\
You are given an excerpt (chunk) from a NERC (North American Electric Reliability \
Corporation) reliability report. Your task is to write 2-3 sentences that:
  1. Identify the document (report type and approximate year if discernible).
  2. Describe what topic this specific chunk covers and how it fits within the \
overall document structure.

Output ONLY the context sentences — no bullet points, no labels, no preamble.

<document>
{doc_preview}
</document>

<chunk>
{chunk_content}
</chunk>
"""


def generate_chunk_contexts(
    chunks: list[dict],
    full_doc: str,
    model: str | None = None,
    max_doc_chars: int = 12_000,
    max_workers: int = 10,
) -> list[dict]:
    """Prepend a Gemini-generated situating context to every chunk (parallel).

    Parameters
    ----------
    chunks : list[dict]
        Output of ``merge_small_chunks()``.
    full_doc : str
        Full cleaned markdown of the document.
    model : str, optional
        Gemini model ID. Defaults to ``GEMINI_MODEL`` env var or ``gemini-2.5-flash``.
    max_doc_chars : int
        Characters of ``full_doc`` sent to the model (head + tail if truncated).
    max_workers : int
        Parallel threads (default 10).

    Returns
    -------
    list[dict]  – each chunk gains a ``"context"`` key; ``"content"`` is prepended.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set — check your .env file.")

    model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    if len(full_doc) > max_doc_chars:
        half = max_doc_chars // 2
        doc_preview = full_doc[:half] + "\n\n[… document truncated …]\n\n" + full_doc[-half:]
    else:
        doc_preview = full_doc

    _local = threading.local()

    def _get_client() -> google_genai.Client:
        if not hasattr(_local, "client"):
            _local.client = google_genai.Client(api_key=api_key)
        return _local.client

    def _generate_one(chunk: dict) -> tuple[int, str]:
        prompt = _CONTEXT_PROMPT.format(
            doc_preview=doc_preview,
            chunk_content=chunk["content"],
        )
        try:
            resp = _get_client().models.generate_content(model=model, contents=prompt)
            return chunk["chunk_index"], resp.text.strip()
        except Exception as exc:
            print(f"  [WARN] chunk {chunk['chunk_index']} – context failed: {exc}")
            return chunk["chunk_index"], ""

    contexts: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_generate_one, c): c for c in chunks}
        for future in tqdm(
            as_completed(futures),
            total=len(futures),
            desc=f"Generating contexts ({max_workers} threads)",
        ):
            idx, ctx = future.result()
            contexts[idx] = ctx

    enriched: list[dict] = []
    for chunk in chunks:
        ctx = contexts.get(chunk["chunk_index"], "")
        nc  = chunk.copy()
        nc["context"] = ctx
        nc["content"] = f"{ctx}\n\n{chunk['content']}" if ctx else chunk["content"]
        enriched.append(nc)

    return enriched


# ---------------------------------------------------------------------------
# Step 5 – attach metadata
# ---------------------------------------------------------------------------

def attach_metadata(
    chunks: list[dict],
    folder: str,
    filename: str,
) -> list[dict]:
    """Attach a metadata dict to every chunk.

    Parameters
    ----------
    chunks : list[dict]
        Output of ``generate_chunk_contexts()``.
    folder : str
        Category subfolder name (e.g. ``"ero-reliability-risk-priorities-reports"``).
    filename : str
        Bare PDF filename.

    Returns
    -------
    list[dict]  – each chunk gains a ``"metadata"`` key.
    """
    file_id = str(uuid.uuid4())
    result: list[dict] = []
    for chunk_no, chunk in enumerate(chunks):
        nc = chunk.copy()
        nc["metadata"] = {
            "folder":   folder,
            "filename": filename,
            "file_id":  file_id,
            "chunk_no": chunk_no,
        }
        result.append(nc)
    return result


# ---------------------------------------------------------------------------
# Step 6 – format for vector DB
# ---------------------------------------------------------------------------

def to_vector_db_records(chunks: list[dict]) -> list[dict]:
    """Convert the final enriched chunks into vector-DB-ready records.

    Each record has three top-level keys that map directly onto a Qdrant
    ``PointStruct`` (or equivalent in any other vector DB):

    * ``"id"``      – unique UUID string per chunk  → point id
    * ``"text"``    – context + content string       → text to embed
    * ``"payload"`` – flat dict with all metadata    → Qdrant payload

    Example Qdrant upsert::

        from qdrant_client.models import PointStruct
        from your_embedder import embed

        records = process_pdf("report.pdf")
        points  = [
            PointStruct(
                id      = r["id"],
                vector  = embed(r["text"]),
                payload = r["payload"],
            )
            for r in records
        ]
        qdrant_client.upsert(collection_name="electrical_grid_data", points=points)
    """
    records: list[dict] = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        records.append({
            "id":   str(uuid.uuid4()),          # unique per chunk
            "text": chunk["content"],            # context prepended → embed this
            "payload": {
                # ── chunk content ──────────────────────────────────────────
                "context":  chunk.get("context", ""),
                "content":  chunk.get("content", ""),
                "title":    chunk.get("title", ""),
                "level":    chunk.get("level", 0),
                # ── file metadata ──────────────────────────────────────────
                "folder":   meta.get("folder", ""),
                "filename": meta.get("filename", ""),
                "file_id":  meta.get("file_id", ""),
                "chunk_no": meta.get("chunk_no", 0),
            },
        })
    return records


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def process_pdf(
    pdf_path: str | Path,
    *,
    min_body_chars: int = 50,
    min_chunk_chars: int = 1000,
    max_doc_chars: int = 12_000,
    context_workers: int = 10,
    gemini_model: str | None = None,
    generate_context: bool = True,
) -> list[dict]:
    """Full pipeline: PDF file → list of vector-DB-ready records.

    Parameters
    ----------
    pdf_path : str | Path
        Path to the PDF file.
    min_body_chars : int
        Minimum body size (chars) for a raw header chunk to be kept (default 50).
    min_chunk_chars : int
        Minimum body size (chars) after merging (default 1000).
    max_doc_chars : int
        Max chars of the document sent to Gemini for context generation (default 12 000).
    context_workers : int
        Number of parallel threads for Gemini calls (default 10).
    gemini_model : str, optional
        Override the Gemini model. Defaults to GEMINI_MODEL env var or gemini-2.5-flash.
    generate_context : bool
        Set to False to skip Gemini context generation (faster, offline use).

    Returns
    -------
    list[dict]
        One record per chunk, each with keys ``"id"``, ``"text"``, ``"payload"``.
        Pass directly to a vector DB upsert function.
    """
    pdf_path = Path(pdf_path)
    folder   = pdf_path.parent.name
    filename = pdf_path.name

    print(f"[1/5] Converting PDF → markdown  ({filename})")
    md = pdf_to_markdown(pdf_path)

    print(f"[2/5] Chunking by headers")
    raw_chunks = chunk_by_headers(md, source=filename, min_body_chars=min_body_chars)
    print(f"      {len(raw_chunks)} raw chunk(s)")

    print(f"[3/5] Merging small chunks (min {min_chunk_chars} chars)")
    merged = merge_small_chunks(raw_chunks, min_chars=min_chunk_chars)
    print(f"      {len(merged)} chunk(s) after merging")

    if generate_context:
        print(f"[4/5] Generating contexts via Gemini ({context_workers} threads)")
        merged = generate_chunk_contexts(
            merged,
            full_doc=md,
            model=gemini_model,
            max_doc_chars=max_doc_chars,
            max_workers=context_workers,
        )
    else:
        print(f"[4/5] Skipping context generation (generate_context=False)")
        for c in merged:
            c["context"] = ""

    print(f"[5/5] Attaching metadata & formatting for vector DB")
    with_meta = attach_metadata(merged, folder=folder, filename=filename)
    records   = to_vector_db_records(with_meta)

    print(f"Done  →  {len(records)} record(s) ready for vector DB.\n")
    return records


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="PDF → vector-DB-ready chunks with Gemini context",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("pdf", help="Path to the input PDF file")
    p.add_argument("--min-body",    type=int,   default=50,     metavar="N",
                   help="Min raw chunk body chars to keep")
    p.add_argument("--min-chars",   type=int,   default=1000,   metavar="N",
                   help="Min merged chunk body chars")
    p.add_argument("--max-doc",     type=int,   default=12_000, metavar="N",
                   help="Max doc chars sent to Gemini")
    p.add_argument("--workers",     type=int,   default=10,     metavar="N",
                   help="Parallel Gemini threads")
    p.add_argument("--model",       type=str,   default=None,
                   help="Gemini model override (default: GEMINI_MODEL env var)")
    p.add_argument("--no-context",  action="store_true",
                   help="Skip Gemini context generation")
    p.add_argument("--out",         type=str,   default=None,   metavar="FILE",
                   help="Save output JSON to this file (default: print summary)")
    return p


if __name__ == "__main__":
    args = _build_parser().parse_args()

    records = process_pdf(
        args.pdf,
        min_body_chars=args.min_body,
        min_chunk_chars=args.min_chars,
        max_doc_chars=args.max_doc,
        context_workers=args.workers,
        gemini_model=args.model,
        generate_context=not args.no_context,
    )

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Saved {len(records)} records → {out_path}")
    else:
        print(f"\n{'=' * 70}")
        print(f"  {len(records)} record(s)  |  sample payload keys: {list(records[0]['payload'])}")
        print(f"{'=' * 70}")
        for r in records[:3]:
            p = r["payload"]
            print(f"\n  id       : {r['id']}")
            print(f"  chunk_no : {p['chunk_no']}  |  folder : {p['folder']}")
            print(f"  title    : {p['title']}")
            print(f"  context  : {p['context'][:120]}{'…' if len(p['context']) > 120 else ''}")
            print(f"  text     : {r['text'][:200]}{'…' if len(r['text']) > 200 else ''}")
