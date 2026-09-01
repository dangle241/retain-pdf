"""Tool registry: name + JSON Schema + handler standard shape.

Conventions & Mainstream agent isomorphic framework——If migrating to a certain SDK,Copy tool definitions verbatim.,
Only replace the loop shell. Each tool returns OK. JSON serialized dict;Retrieval results uniformly include.
(document_id, job_id, page_idx, block_id) anchor, and numbered by agent layer
Referenceable ref。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote

from .blocks import read_page_blocks
from .config import Settings
from .rust_client import RustApiClient

# job_id Whitelist: starts with alphanumeric + [-._] Compose; forbid path separators/..。
# Critical security boundary——job_id From model tool params (context includes doc content = Prompt injection surface
# Concatenate directly. data_root/jobs/<job_id> Gate check mandatory. Prevents directory traversal.
_SAFE_JOB_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def _safe_job_root(settings: Settings, job_id: str) -> Path | None:
    """job_id Return if valid. jobs directory under root, otherwise None(Caller handles as task not found)."""
    if not _SAFE_JOB_ID_RE.fullmatch(job_id) or ".." in job_id:
        return None
    return settings.data_root / "jobs" / job_id


def _list_markdown_image_urls(job_root: Path, job_id: str, page_idx: int, *, limit: int = 8) -> list[str]:
    """List This Page OCR Markdown Image,Return pullable with authentication. API Relative path.

    Disk: jobs/<job>/md/images/page-<1-based>/...
    API:  /api/v1/jobs/<job>/markdown/images/<rel-without-images-prefix>
    """
    page_dir = job_root / "md" / "images" / f"page-{int(page_idx) + 1}"
    if not page_dir.is_dir():
        return []
    urls: list[str] = []
    for path in sorted(page_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}:
            continue
        try:
            rel = path.relative_to(job_root / "md" / "images").as_posix()
        except ValueError:
            continue
        encoded = "/".join(quote(part, safe="") for part in rel.split("/"))
        urls.append(f"/api/v1/jobs/{job_id}/markdown/images/{encoded}")
        if len(urls) >= limit:
            break
    return urls


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[[dict[str, Any]], dict[str, Any]]

    def as_openai_tool(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    def __init__(self, tools: list[Tool]) -> None:
        self._tools = {tool.name: tool for tool in tools}

    def specs(self) -> list[dict[str, Any]]:
        return [tool.as_openai_tool() for tool in self._tools.values()]

    def invoke(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tool = self._tools.get(name)
        if tool is None:
            return {"error": f"unknown tool: {name}"}
        try:
            return tool.handler(arguments)
        except Exception as exc:  # Return tool failure to model as result.,Don't break loop
            return {"error": f"{type(exc).__name__}: {exc}"}


def build_default_registry(settings: Settings, rust: RustApiClient) -> ToolRegistry:
    def search_fulltext(arguments: dict[str, Any]) -> dict[str, Any]:
        query = str(arguments.get("query") or "").strip()
        if not query:
            return {"error": "query must not be empty"}
        limit = int(arguments.get("limit") or 10)
        document_id = str(arguments.get("document_id") or "").strip()
        hits = rust.search_fulltext(
            query,
            limit=max(1, min(limit, 30)),
            document_id=document_id,
        )
        # Attach to hit page. Markdown Graph path,Facilitate model usage in responses. ![alt](url) Illustration
        enriched_hits: list[dict[str, Any]] = []
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            item = dict(hit)
            hit_job_id = str(item.get("job_id") or "").strip()
            try:
                hit_page = int(item.get("page_idx") or 0)
            except (TypeError, ValueError):
                hit_page = 0
            if hit_job_id:
                job_root = _safe_job_root(settings, hit_job_id)
                if job_root is not None:
                    images = _list_markdown_image_urls(job_root, hit_job_id, hit_page, limit=4)
                    if images:
                        item["image_urls"] = images
            enriched_hits.append(item)
        payload: dict[str, Any] = {"hits": enriched_hits}
        if document_id:
            payload["document_id"] = document_id
        if document_id and not enriched_hits:
            payload["hint"] = (
                "Full-text index no hits: may not be built. blocks_fts，"
                "or keyword not in original/Translating. Adjust keywords or state no evidence yet."
            )
        return payload

    def list_documents(arguments: dict[str, Any]) -> dict[str, Any]:
        # Entire Q&A session injected document_idReturn current document only to avoid cross-library noise.
        scoped_id = str(arguments.get("document_id") or "").strip()
        if scoped_id:
            try:
                document = rust.get_document(scoped_id)
            except Exception as exc:
                return {"error": f"{type(exc).__name__}: {exc}", "documents": []}
            return {
                "documents": [
                    {
                        "document_id": document.get("document_id"),
                        "title": document.get("title"),
                        "page_count": document.get("page_count"),
                        "tags": document.get("tags"),
                        "reading_status": document.get("reading_status"),
                    }
                ]
            }
        documents = rust.list_documents(
            tag=str(arguments.get("tag") or ""),
            reading_status=str(arguments.get("reading_status") or ""),
            limit=int(arguments.get("limit") or 50),
        )
        # Return only fields required by model,Don't dump the entire record into context.
        return {
            "documents": [
                {
                    "document_id": document.get("document_id"),
                    "title": document.get("title"),
                    "page_count": document.get("page_count"),
                    "tags": document.get("tags"),
                    "reading_status": document.get("reading_status"),
                }
                for document in documents
            ]
        }

    def read_blocks(arguments: dict[str, Any]) -> dict[str, Any]:
        document_id = str(arguments.get("document_id") or "").strip()
        page_idx = arguments.get("page_idx")
        if not document_id or page_idx is None:
            return {"error": "document_id and page_idx are required"}
        # Prioritize in request. job_id(current reading task, including history) run), then fallback to active_job_id
        job_id = str(arguments.get("job_id") or "").strip()
        if not job_id:
            document = rust.get_document(document_id)
            job_id = str(document.get("active_job_id") or "")
        if not job_id:
            return {"error": f"document {document_id} has no active job"}
        job_root = _safe_job_root(settings, job_id)
        if job_root is None:
            return {"error": f"invalid job_id: {job_id!r}"}
        page_i = int(page_idx)
        blocks = read_page_blocks(
            job_root,
            page_i,
            around_block_id=str(arguments.get("around_block_id") or ""),
            max_blocks=int(arguments.get("max_blocks") or 12),
        )
        image_urls = _list_markdown_image_urls(job_root, job_id, page_i, limit=8)
        return {
            "document_id": document_id,
            "job_id": job_id,
            "page_idx": page_i,
            "blocks": [
                {
                    "block_id": block.block_id,
                    "source_text": block.source_text[:600],
                    "translated_text": block.translated_text[:600],
                }
                for block in blocks
            ],
            "image_urls": image_urls,
        }

    def search_favorites(arguments: dict[str, Any]) -> dict[str, Any]:
        keyword = str(arguments.get("keyword") or "").strip().lower()
        favorites = rust.list_favorites(str(arguments.get("document_id") or ""))
        if keyword:
            favorites = [
                favorite
                for favorite in favorites
                if keyword in str(favorite.get("quote_text", "")).lower()
                or keyword in str(favorite.get("translated_quote_text", "")).lower()
                or keyword in str(favorite.get("note", "")).lower()
            ]
        return {
            "favorites": [
                {
                    "favorite_id": favorite.get("favorite_id"),
                    "document_id": favorite.get("document_id"),
                    "job_id": favorite.get("job_id"),
                    "page_idx": favorite.get("page_idx"),
                    "block_id": favorite.get("block_id"),
                    "kind": favorite.get("kind"),
                    "quote_text": favorite.get("quote_text"),
                    "translated_quote_text": favorite.get("translated_quote_text"),
                    "note": favorite.get("note"),
                }
                for favorite in favorites[:30]
            ]
        }

    return ToolRegistry(
        [
            Tool(
                name="list_documents",
                description="List documents in the library(Title, Tags, Read Status)No input.'Which document?/My Library'First use it to confirm the scope.",
                parameters={
                    "type": "object",
                    "properties": {
                        "tag": {"type": "string", "description": "Filter by tag,可选"},
                        "reading_status": {
                            "type": "string",
                            "enum": ["unread", "reading", "done"],
"description": "Filter by read status, optional",
                        },
                        "limit": {"type": "integer", "minimum": 1, "maximum": 200},
                    },
                },
                handler=list_documents,
            ),
            Tool(
                name="search_fulltext",
                description=(
                    "Full-text search(English.),Return with (document_id, job_id, page_idx, block_id) Anchor match snippet;"
                    "If hit page exists OCR Figure attached. image_urls(Embeddable in answers Markdown Image path)。"
                    "Primary tool for finding evidence.,Call multiple times with different keywords."
                    "If session is restricted to documents.,Be sure to pass. document_id,Search only within this document."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search keywords or phrases"},
                        "document_id": {
                            "type": "string",
                            "description": "Single document only;Current must be passed for full Q&A. document_id",
                        },
                        "limit": {"type": "integer", "minimum": 1, "maximum": 30},
                    },
                    "required": ["query"],
                },
                handler=search_fulltext,
            ),
            Tool(
                name="read_blocks",
                description=(
"Read source and translation blocks for a given document page, and include that page's Markdown image image_urls."
                    "View full context of the retrieval hit.(pass around_block_id Get window centered on hit block.);"
                    "Use for chart-related questions. image_urls Embed Markdown Image."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "document_id": {"type": "string"},
                        "page_idx": {"type": "integer", "minimum": 0},
                        "job_id": {
                            "type": "string",
                            "description": "Prioritize reading this task artifact.;Use documentation as default. active_job_id",
                        },
                        "around_block_id": {"type": "string", "description": "Get context centered on this block.,可选"},
                        "max_blocks": {"type": "integer", "minimum": 1, "maximum": 30},
                    },
                    "required": ["document_id", "page_idx"],
                },
                handler=read_blocks,
            ),
            Tool(
                name="search_favorites",
                description="Retrieve user's bookmarked sentences./Data(Filter by keyword and document.)Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:  ```python if token_expiry < now:  # ponytail: ceiling is millisecond precision; add when sub-second expiry required     raise AuthError("Token expired") ```'Favorites/Marked by me'Use with content.",
                parameters={
                    "type": "object",
                    "properties": {
                        "keyword": {"type": "string", "description": "Filter keywords in citations and notes.,可选"},
                        "document_id": {"type": "string", "description": "Restrict document,可选"},
                    },
                },
                handler=search_favorites,
            ),
        ]
    )
