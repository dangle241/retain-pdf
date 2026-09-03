"""Tool registry: standard shape of name + JSON Schema + handler.

Conventions are isomorphic to mainstream agent frameworks — if migrating to an SDK later,
tool definitions move as-is, only the outer loop changes. Each tool returns a JSON-serializable
dict; retrieval results uniformly carry (document_id, job_id, page_idx, block_id) anchors,
which the agent layer numbers into citable refs.
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

# job_id allowlist: starts with alphanumeric + [-._], path separators and .. are forbidden.
# Critical security boundary — job_id comes from model tool arguments (context contains document content = prompt injection surface).
# Must pass this gate before being joined into data_root/jobs/<job_id>, otherwise directory traversal is possible.
_SAFE_JOB_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def _safe_job_root(settings: Settings, job_id: str) -> Path | None:
    """Return the directory under jobs root if job_id is valid, otherwise None (caller treats as non-existent task)."""
    if not _SAFE_JOB_ID_RE.fullmatch(job_id) or ".." in job_id:
        return None
    return settings.data_root / "jobs" / job_id


def _list_markdown_image_urls(job_root: Path, job_id: str, page_idx: int, *, limit: int = 8) -> list[str]:
    """List OCR Markdown images for the page, returning API-relative paths that can be fetched with auth.

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
        except Exception as exc:  # Tool failures are fed back to the model as results, without interrupting the loop
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
        # Attach Markdown image paths to hits so the model can embed them in answers as ![alt](url)
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
                "该文档全文索引无命中：可能尚未建立 blocks_fts，"
                "或关键词不在原文/译文中。可换关键词，或说明暂无证据。"
            )
        return payload

    def list_documents(arguments: dict[str, Any]) -> dict[str, Any]:
        # Whole-book Q&A sessions inject document_id: only return the current document to avoid cross-library noise
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
        # Only return fields the model needs; don't dump the full record into context
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
        # Prefer job_id from the request (current reading task, including historical runs), fallback to active_job_id
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
                description="列出图书馆中的文档(标题、标签、阅读状态)。回答涉及'哪篇文档/我的库里'时先用它确认范围。",
                parameters={
                    "type": "object",
                    "properties": {
                        "tag": {"type": "string", "description": "按标签过滤,可选"},
                        "reading_status": {
                            "type": "string",
                            "enum": ["unread", "reading", "done"],
                            "description": "按阅读状态过滤,可选",
                        },
                        "limit": {"type": "integer", "minimum": 1, "maximum": 200},
                    },
                },
                handler=list_documents,
            ),
            Tool(
                name="search_fulltext",
                description=(
                    "全文检索(中英文均可),返回带 (document_id, job_id, page_idx, block_id) 锚点的命中片段;"
                    "命中页若有 OCR 图会附 image_urls(可嵌入回答的 Markdown 图片路径)。"
                    "这是找证据的主要工具,可多次换关键词调用。"
                    "若会话已限定文档,请务必传 document_id,只在该文档内检索。"
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "search keyword or phrase"},
                        "document_id": {
                            "type": "string",
                            "description": "限定单文档;整本问答时必传当前 document_id",
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
                    "读取某文档某页的原文与译文块,并附带该页 Markdown 图片 image_urls。"
                    "用于查看检索命中处的完整上下文(传 around_block_id 以命中块为中心取窗口);"
                    "回答图表相关问题时用 image_urls 嵌入 Markdown 图片。"
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "document_id": {"type": "string"},
                        "page_idx": {"type": "integer", "minimum": 0},
                        "job_id": {
                            "type": "string",
                            "description": "优先读该任务产物;缺省用文档 active_job_id",
                        },
                        "around_block_id": {"type": "string", "description": "以此块为中心取上下文,可选"},
                        "max_blocks": {"type": "integer", "minimum": 1, "maximum": 30},
                    },
                    "required": ["document_id", "page_idx"],
                },
                handler=read_blocks,
            ),
            Tool(
                name="search_favorites",
                description="检索用户收藏过的句子/数据(可按关键词与文档过滤)。问题涉及'我收藏的/我标记过的'内容时使用。",
                parameters={
                    "type": "object",
                    "properties": {
                        "keyword": {"type": "string", "description": "在引文与备注里做关键词过滤,可选"},
                        "document_id": {"type": "string", "description": "限定某文档,可选"},
                    },
                },
                handler=search_favorites,
            ),
        ]
    )
