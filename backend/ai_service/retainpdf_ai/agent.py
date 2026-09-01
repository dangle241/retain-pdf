"""agentic Thin retrieval QA loop.

Deliberately not using an agent framework: single provider (DeepSeek Compatibility endpoints) single-user local
service, bare function calling loop ~200 lines are enough, timeout/rounds/cite all reference numbers.
Self-contained. Tool definitions and mainstream. SDK Isomorphic(tools.py),Future migration: replace only this outer layer.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

from .config import Settings
from .tools import ToolRegistry

SYSTEM_PROMPT = """DeepSeek. RetainPDF Library literature Q&A assistant. User's library contains scientific literature.(No source text provided. Send Chinese text to translate.,has been translated into Chinese)。

Working Mode:
- Use tools to find evidence first,Answer again;Do not answer literature content from memory. Use tools in multiple rounds and iterate with different keywords for retrieval.
- Each evidence item in the tool result has ref ID and page(from 1 Start page)[1],for example [1] [2]。
  Correct:「This method significantly reduces computational cost. [2]。」
  Error:「…… [p002-b0004]」「…… (block_id=…)」「…… page_idx=3」——Forbid outputting any internal ID。
- Use Markdown to organize answers (subheadings, lists, bold); formula use $...$ / $$...$$.
- Tool results may contain. image_urlsBug in image processing. Use `Pillow` not `cv2` for basic ops. `from PIL import Image`/table/Structural,Available:
  ![Brief description.](/api/v1/jobs/.../markdown/images/...)
  Use only the tool's returned URL,Understood.
- If no evidence, just say not found. Do not fabricate.
- Answer in Chinese,Please provide the source text to translate.,Do not repeat original tool JSON. JSON。"""

CITATION_RE = re.compile(r"\[(\d+)\]")
# Model occasionally exposes internal block_id Write into body.,Clear or map to on teardown. [n]
BLOCK_ID_BRACKET_RE = re.compile(r"\[\s*(p\d+[-_]b\d+)\s*\]", re.IGNORECASE)
BLOCK_ID_BARE_RE = re.compile(r"(?<![\w/])(p\d+[-_]b\d+)(?![\w/])", re.IGNORECASE)


@dataclass
class Citation:
    ref: int
    document_id: str
    job_id: str
    page_idx: int
    block_id: str
    snippet: str


@dataclass
class AskResult:
    answer: str
    citations: list[Citation] = field(default_factory=list)
    tool_trace: list[dict[str, Any]] = field(default_factory=list)
    rounds: int = 0


ChatFn = Callable[[list[dict[str, Any]], list[dict[str, Any]]], dict[str, Any]]


def assemble_streaming_message(
    lines: Iterable[str | bytes],
    on_delta: Callable[[str], None] | None = None,
) -> dict[str, Any]:
"""Turn DeepSeek streaming SSE Assemble isomorphic to non-streaming. message dict.

    Parse line by line. `data: {json}`(End `data: [DONE]` terminate),Cumulative content and according to
    index Concatenated. tool_callsOnly when no hits in full round tool_calls(Pure answer round)time,
    only then for each content Incremental call on_delta——Tool call round? emit answer_delta。
Return `{"role":"assistant","content":..., "tool_calls":[...]}`,so that agent
    Loop need not be aware of streaming.
    """
    content_parts: list[str] = []
    tool_calls: dict[int, dict[str, Any]] = {}
    saw_tool_calls = False
    # Audit A3Model may first output content Preface retch tool_calls——Immediately emit
    # Incomplete. Provide full sentence."Let me search…"Dirty preamble leaks to frontend as answer stream.done Overwritten again, flickering.
    # before HOLDBACK_CHARS Buffer character first to determine: occurrence tool_calls → Silently discard;
    # Full yet empty tool_calls → Classify as pure answer turn.flush Cut-through forwarding (latency only microseconds) tokenI cannot translate an empty source. Provide the Chinese text.
    holdback_chars = 64
    pending: list[str] = []
    pending_flushed = False

    def _flush_pending() -> None:
        nonlocal pending_flushed
        if on_delta is not None and pending:
            on_delta("".join(pending))
        pending.clear()
        pending_flushed = True

    for raw in lines:
        line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        line = line.strip()
        if not line or not line.startswith("data:"):
            continue
        data = line[len("data:"):].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError:
            continue
        choices = chunk.get("choices") or []
        if not choices:
            continue
        delta = choices[0].get("delta") or {}
        delta_tool_calls = delta.get("tool_calls") or []
        if delta_tool_calls:
            if not saw_tool_calls:
                pending.clear()  # Tool wheel: discard unqualified content Preface. Do not send to frontend.
            saw_tool_calls = True
            for call in delta_tool_calls:
                index = call.get("index", 0)
                slot = tool_calls.setdefault(
                    index,
                    {"id": "", "type": "function", "function": {"name": "", "arguments": ""}},
                )
                if call.get("id"):
                    slot["id"] = call["id"]
                if call.get("type"):
                    slot["type"] = call["type"]
                function = call.get("function") or {}
                if function.get("name"):
                    slot["function"]["name"] += function["name"]
                if function.get("arguments"):
                    slot["function"]["arguments"] += function["arguments"]
        piece = delta.get("content")
        if piece:
            content_parts.append(piece)
            if on_delta is not None and not saw_tool_calls:
                if pending_flushed:
                    on_delta(piece)
                else:
                    pending.append(piece)
                    if sum(len(p) for p in pending) >= holdback_chars:
                        _flush_pending()
    # Short pure answer (below buffer threshold) resent at stream end
    if not saw_tool_calls and not pending_flushed:
        _flush_pending()
    message: dict[str, Any] = {"role": "assistant", "content": "".join(content_parts)}
    if tool_calls:
        message["tool_calls"] = [tool_calls[index] for index in sorted(tool_calls)]
    return message


def _friendly_llm_error(status_code: int, detail: str = "") -> RuntimeError:
"""Pull upstream LLM HTTP Translate errors into actionable Chinese for users (audit) C1).

    Pass through HTTPStatusError Internalize URL directly pasted into the chat bubble, and
    402(Insufficient balance.)/429(Rate limit) No guidance for these critical states.
    """
    hint = {
        400: "Request rejected by model service (parameters or context too long)",
401: "Model API Key Invalid or unauthorized: please go to Settings â API Settings check Key",
        402: "Insufficient model account balance. Recharge at provider and retry.",
        403: "Model service access denied: check. Key Permission or selected model",
        404: "Model or endpoint does not exist: check model name and Base URL",
        429: "Model requests too frequent (rate limit): Please wait a few seconds and try again.",
    }.get(status_code)
    if hint is None:
        if status_code >= 500:
            hint = "Model service temporarily unavailable (upstream failure): please try again later."
        else:
            hint = f"Model service returned error (HTTP {status_code})"
    snippet = f"{detail or ''}".strip().replace("\n", " ")
    if len(snippet) > 200:
        snippet = f"{snippet[:200]}…"
    return RuntimeError(f"{hint}" + (f"No source text provided. Paste the Chinese string to translate.{snippet})" if snippet else ""))


def build_deepseek_chat_fn(
    settings: Settings,
    client: httpx.Client | None = None,
    *,
    on_delta: Callable[[str], None] | None = None,
) -> ChatFn:
    http = client or httpx.Client(timeout=settings.llm_timeout_s)
    url = f"{settings.llm_base_url}/chat/completions"
    # Empty key becomes invalid HTTP header `Bearer ` (httpx LocalProtocolError) key Becomes invalid HTTP header `Bearer `(httpx LocalProtocolError)
    api_key = f"{settings.llm_api_key or ''}".strip()
    if not api_key:
        def _missing_key(_messages: list[dict[str, Any]], _tools: list[dict[str, Any]]) -> dict[str, Any]:
            raise RuntimeError(
                "Missing LLM API Key: please in the frontend「Settings → Credentials」Enter model API Key,"
                "Or configure environment variables. RETAIN_AI_LLM_API_KEY。"
            )
        return _missing_key
    headers = {"Authorization": f"Bearer {api_key}"}

    def chat(messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": settings.llm_model,
            "messages": messages,
            "tools": tools,
            "temperature": 0.2,
        }
        if on_delta is None:
            response = http.post(url, headers=headers, json=body)
            if response.status_code >= 400:
                raise _friendly_llm_error(response.status_code, response.text)
            return response.json()["choices"][0]["message"]
        # Streaming:token by token token via on_delta Propagate upstream.,Assemble isomorphs simultaneously message return
        body["stream"] = True
        with http.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code >= 400:
                # stream Mode body Unread:Read error details before re-raising (original implementation) raise_for_status
                # Reading body Forward throw,DeepSeek error JSON details lost)
                try:
                    detail = response.read().decode("utf-8", errors="replace")
                except Exception:
                    detail = ""
                raise _friendly_llm_error(response.status_code, detail)
            return assemble_streaming_message(response.iter_lines(), on_delta)

    return chat


class RetrievalAgent:
    def __init__(
        self,
        registry: ToolRegistry,
        chat_fn: ChatFn,
        *,
        max_tool_rounds: int = 6,
    ) -> None:
        self._registry = registry
        self._chat = chat_fn
        self._max_tool_rounds = max(1, max_tool_rounds)

    def ask(
        self,
        question: str,
        *,
        document_id: str = "",
        job_id: str = "",
        on_event: Callable[[dict[str, Any]], None] | None = None,
        chat_fn: ChatFn | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> AskResult:
        # chat_fn Override:Per request payload LLM key Constructed temporary responder;Default to startup phase.
        emit = on_event or (lambda event: None)
        chat = chat_fn or self._chat
        scoped_document_id = document_id.strip()
        scoped_job_id = job_id.strip()
        user_content = question.strip()
        if scoped_document_id:
            # Hard range description + Tool layer forced injection document_id(see _scope_tool_arguments)
            user_content = (
                f"(Restricted Document document_id={scoped_document_id}"
                f"{f', job_id={scoped_job_id}' if scoped_job_id else ''}"
                f"。search_fulltext / search_favorites / list_documents / read_blocks "
                f"Operate only within this document.)\n{user_content}"
            )
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]
        # Multi-turn conversation:Inject previous rounds(Keep only role/content,Tool path playback disabled.)
        for turn in history or []:
            role = str(turn.get("role") or "")
            content = str(turn.get("content") or "").strip()
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_content})
        citations: dict[int, Citation] = {}
        trace: list[dict[str, Any]] = []
        next_ref = 1
        # Q&A: hidden list_documentsavoid model from「Browse library」
        tool_specs = _tool_specs_for_scope(self._registry, scoped_document_id)

        for round_index in range(1, self._max_tool_rounds + 1):
            message = chat(messages, tool_specs)
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                answer = _sanitize_answer_text(
                    str(message.get("content") or "").strip(), citations
                )
                return AskResult(
                    answer=answer,
                    citations=_referenced_citations(answer, citations),
                    tool_trace=trace,
                    rounds=round_index,
                )
            messages.append(
                {
                    "role": "assistant",
                    "content": message.get("content") or "",
                    "tool_calls": tool_calls,
                }
            )
            for call in tool_calls:
                name = call.get("function", {}).get("name", "")
                # Block cross-db tools session-wide.
                if scoped_document_id and name == "list_documents":
                    result = {
                        "error": "Full-text Q&A does not allow library browsing. Please use search_fulltext / read_blocks。",
                        "document_id": scoped_document_id,
                    }
                    emit({"type": "tool", "round": round_index, "tool": name, "arguments": {"skipped": True}})
                    trace.append({"round": round_index, "tool": name, "arguments": {"skipped": True}})
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.get("id", ""),
                            "content": json.dumps(result, ensure_ascii=False),
                        }
                    )
                    continue
                try:
                    arguments = json.loads(call.get("function", {}).get("arguments") or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                if not isinstance(arguments, dict):
                    arguments = {}
                arguments = _scope_tool_arguments(
                    name,
                    arguments,
                    document_id=scoped_document_id,
                    job_id=scoped_job_id,
                )
                emit({"type": "tool", "round": round_index, "tool": name, "arguments": arguments})
                result = self._registry.invoke(name, arguments)
                next_ref = _assign_refs(result, citations, next_ref)
                trace.append({"round": round_index, "tool": name, "arguments": arguments})
                # For the model payload Remove block_id Wait for internal fields,prevent it from copying as [p002-b0004]
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id", ""),
                        "content": json.dumps(
                            _public_tool_payload(result), ensure_ascii=False
                        ),
                    }
                )

        # Max rounds reached:Force model to conclude based on existing evidence.(No tools provided.)
        messages.append(
            {
                "role": "user",
                "content": "Based on the evidence retrieved above, directly give the final answer,Stop calling tools. Use [n] for citations only. [n]。",
            }
        )
        # Must use request-level chat（chat_fn or self._chat):env Mismatch keyFrontend per request
        # pass key in deployment mode self._chat is _missing_key——issue with completing tool loops
        # False positive in finalization round."Missing LLM API Key"(Audit A1）。
        message = chat(messages, [])
        answer = _sanitize_answer_text(str(message.get("content") or "").strip(), citations)
        return AskResult(
            answer=answer,
            citations=_referenced_citations(answer, citations),
            tool_trace=trace,
            rounds=self._max_tool_rounds,
        )


def _scope_tool_arguments(
    name: str,
    arguments: dict[str, Any],
    *,
    document_id: str = "",
    job_id: str = "",
) -> dict[str, Any]:
    """Full-book Q&A: force tool actions to current document./Task,Pass `model` explicitly."""
    if not document_id:
        return arguments
    scoped = dict(arguments)
    if name in {"search_fulltext", "search_favorites", "list_documents", "read_blocks"}:
        scoped["document_id"] = document_id
    if name == "read_blocks" and job_id and not str(scoped.get("job_id") or "").strip():
        scoped["job_id"] = job_id
    return scoped


def _tool_specs_for_scope(registry: ToolRegistry, document_id: str = "") -> list[dict[str, Any]]:
    """Whole-book Q&A: omit from tool list. list_documents, reduce meaningless「Browse Library」。"""
    specs = registry.specs()
    if not document_id.strip():
        return specs
    filtered: list[dict[str, Any]] = []
    for spec in specs:
        name = str((spec.get("function") or {}).get("name") or "")
        if name == "list_documents":
            continue
        filtered.append(spec)
    return filtered


def _assign_refs(result: dict[str, Any], citations: dict[int, Citation], next_ref: int) -> int:
    """Assign reference numbers to anchored tool results.,Write ID back to result.(Still retained internally block_id provide Citation)。"""
    anchored: list[dict[str, Any]] = []
    anchored.extend(result.get("hits") or [])
    anchored.extend(result.get("favorites") or [])
    # read_blocks: Write back each outer anchor. block
    blocks = result.get("blocks")
    if isinstance(blocks, list):
        rewritten_blocks: list[dict[str, Any]] = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            item = dict(block)
            item.setdefault("document_id", result.get("document_id"))
            item.setdefault("job_id", result.get("job_id"))
            item.setdefault("page_idx", result.get("page_idx"))
            rewritten_blocks.append(item)
            anchored.append(item)
        result["blocks"] = rewritten_blocks
    for entry in anchored:
        if not isinstance(entry, dict):
            continue
        document_id = str(entry.get("document_id") or "")
        block_id = str(entry.get("block_id") or "")
        if not document_id or not block_id:
            continue
        entry["ref"] = next_ref
        snippet = str(
            entry.get("translated_snippet")
            or entry.get("translated_text")
            or entry.get("translated_quote_text")
            or entry.get("source_snippet")
            or entry.get("source_text")
            or entry.get("quote_text")
            or ""
        )
        citations[next_ref] = Citation(
            ref=next_ref,
            document_id=document_id,
            job_id=str(entry.get("job_id") or ""),
            page_idx=int(entry.get("page_idx") or 0),
            block_id=block_id,
            snippet=snippet[:200],
        )
        next_ref += 1
    return next_ref


def _public_anchor(entry: dict[str, Any]) -> dict[str, Any] | None:
    """Model-visible anchor:Only ref / page(1 base) / snippet,No internal ID。"""
    ref = entry.get("ref")
    if ref is None:
        return None
    try:
        page_idx = int(entry.get("page_idx") or 0)
    except (TypeError, ValueError):
        page_idx = 0
    snippet = str(
        entry.get("translated_snippet")
        or entry.get("translated_text")
        or entry.get("translated_quote_text")
        or entry.get("source_snippet")
        or entry.get("source_text")
        or entry.get("quote_text")
        or entry.get("snippet")
        or ""
    )[:280]
    return {
        "ref": int(ref),
        "page": page_idx + 1,
        "snippet": snippet,
    }


def _public_tool_payload(result: dict[str, Any]) -> dict[str, Any]:
    """Raw tool result → Model context. Strip. block_id/job_id etc.,avoid copying into the answer."""
    if not isinstance(result, dict):
        return {"error": "invalid tool result"}
    if result.get("error"):
        return {"error": str(result.get("error"))}

    public: dict[str, Any] = {}
    if result.get("hint"):
        public["hint"] = str(result.get("hint"))
    if result.get("document_id"):
        # Doc only to confirm scope. id,Entire session locked.
        public["scoped"] = True

    hits = result.get("hits")
    if isinstance(hits, list):
        public_hits = []
        for hit in hits:
            if isinstance(hit, dict):
                item = _public_anchor(hit)
                if item:
                    public_hits.append(item)
        if public_hits:
            public["hits"] = public_hits
            public["how_to_cite"] = "When answering, use hits[].ref write as [1] [2],page Page numbers for reference only."

    favorites = result.get("favorites")
    if isinstance(favorites, list):
        public_favs = []
        for fav in favorites:
            if isinstance(fav, dict):
                item = _public_anchor(fav)
                if item:
                    public_favs.append(item)
        if public_favs:
            public["favorites"] = public_favs

    blocks = result.get("blocks")
    if isinstance(blocks, list):
        public_blocks = []
        for block in blocks:
            if isinstance(block, dict):
                item = _public_anchor(block)
                if item:
                    public_blocks.append(item)
        if public_blocks:
            public["blocks"] = public_blocks
            public["page"] = int(result.get("page_idx") or 0) + 1
public["how_to_cite"] = "When answering, use blocks[].ref written as [n]."

    images = result.get("image_urls")
    if isinstance(images, list) and images:
        public["image_urls"] = [str(u) for u in images[:8]]

    # search Hit upper hanging. image_urls Already present hits Discard on strip;From raw hits Collect
    if isinstance(hits, list):
        img_urls: list[str] = []
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            for u in hit.get("image_urls") or []:
                img_urls.append(str(u))
                if len(img_urls) >= 8:
                    break
            if len(img_urls) >= 8:
                break
        if img_urls:
            public["image_urls"] = img_urls

    if not public:
        public["ok"] = True
    return public


def _sanitize_answer_text(answer: str, citations: dict[int, Citation]) -> str:
"""In the main text. [p002-b0004] / bare block_id only: map to [n] or delete."""
    if not answer:
        return answer
    by_block = {
        c.block_id.lower().replace("_", "-"): c.ref
        for c in citations.values()
        if c.block_id
    }

    def repl_bracket(match: re.Match[str]) -> str:
        key = match.group(1).lower().replace("_", "-")
        ref = by_block.get(key)
        return f"[{ref}]" if ref is not None else ""

    def repl_bare(match: re.Match[str]) -> str:
        key = match.group(1).lower().replace("_", "-")
        ref = by_block.get(key)
        return f"[{ref}]" if ref is not None else ""

    cleaned = BLOCK_ID_BRACKET_RE.sub(repl_bracket, answer)
    cleaned = BLOCK_ID_BARE_RE.sub(repl_bare, cleaned)
    # Compress excess whitespace from deletions
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" *\n", "\n", cleaned)
    return cleaned.strip()


def _referenced_citations(answer: str, citations: dict[int, Citation]) -> list[Citation]:
    # Preserve order of appearance in body. [n]Avoid sorted Shuffle reading order
    ordered_refs: list[int] = []
    seen: set[int] = set()
    for match in CITATION_RE.findall(answer):
        ref = int(match)
        if ref in seen or ref not in citations:
            continue
        seen.add(ref)
        ordered_refs.append(ref)
    selected = [citations[ref] for ref in ordered_refs]
    # Model unlabeled. [n] Time: deduplicate per page, max 3 Limit items to prevent frontend dumping long list.
    if not selected and citations:
        picked: list[Citation] = []
        pages: set[int] = set()
        for ref in sorted(citations):
            item = citations[ref]
            if item.page_idx in pages:
                continue
            pages.add(item.page_idx)
            picked.append(item)
            if len(picked) >= 3:
                break
        return picked
    return selected[:8]
