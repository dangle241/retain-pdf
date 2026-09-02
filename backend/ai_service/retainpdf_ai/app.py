"""FastAPI app: auth + /v1/ask + health check."""

from __future__ import annotations

import json
import queue
import threading
from dataclasses import asdict, replace
from typing import Any, Iterator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import __version__
from .agent import RetrievalAgent, build_deepseek_chat_fn
from .config import Settings, load_settings
from .memory import assemble_history, maybe_compress_transcript
from .rust_client import RustApiClient
from .tools import build_default_registry


class AskInput(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_id: str = ""
    # Can pass only job_id (includes historical runs): server resolves the owning document to avoid
    # frontend silent mismatch when looking up active_job_id against historical jobs, which degrades Q&A to full-library search.
    job_id: str = ""
    # Multi-turn dialogue: pass conversation ID to inject previous turns as context; after completion
    # write back user/assistant pair via Rust API (single writer invariant preserved).
    # When omitted, auto-create via Rust if reachable, and return conversation_id in done.
    conversation_id: str = ""
    # Message tree: new user parent = current head; retry = the retried user message id.
    parent_id: str = ""
    # Regenerate: only attach new assistant to parent_id (user), do not rewrite user.
    regenerate: bool = False
    # Client-stable message id, aligned with frontend store / assistant-ui.
    user_message_id: str = ""
    assistant_message_id: str = ""
    stream: bool = False
    # B2: force trigger extractive compression (test/debug)
    force_compress: bool = False
    # Per-request LLM credentials from frontend: fall back to startup env config if left empty
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""


def build_app(
    settings: Settings | None = None,
    agent: RetrievalAgent | None = None,
    rust: RustApiClient | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    if agent is None:
        # LLM key is no longer mandatory: env may be empty, frontend passes per-request (see AskInput.llm_api_key)
        if not settings.rust_api_key:
            raise RuntimeError("RETAIN_AI_RUST_API_KEY is required")
        rust = rust or RustApiClient(settings)
        agent = RetrievalAgent(
            build_default_registry(settings, rust),
            build_deepseek_chat_fn(settings),
            max_tool_rounds=settings.max_tool_rounds,
        )

    app = FastAPI(title="retainpdf-ai", version=__version__)

    def resolve_document_id(payload: AskInput) -> str:
        document_id = payload.document_id.strip()
        if document_id or not payload.job_id.strip() or rust is None:
            return document_id
        try:
            document = rust.get_document_by_job(payload.job_id.strip())
        except Exception:
            return ""
        return str((document or {}).get("document_id") or "")

    def ensure_conversation_id(payload: AskInput, document_id: str) -> str:
        """B1: use existing conversation_id; otherwise auto-create via Rust and return the new id."""
        existing = payload.conversation_id.strip()
        if existing:
            return existing
        if rust is None:
            return ""
        title = (payload.question or "").strip().replace("\n", " ")
        if len(title) > 48:
            title = f"{title[:48].rstrip()}…"
        if not title:
            title = "Reading Q&A"
        try:
            created = rust.create_conversation(title=title, document_id=document_id or "")
            return str((created or {}).get("conversation_id") or "").strip()
        except Exception as exc:
            print(f"[retainpdf-ai] auto-create conversation failed: {exc}", flush=True)
            return ""

    def _visible_path(
        messages: list[dict[str, Any]],
        head_id: str,
        *,
        stop_at: str = "",
    ) -> list[dict[str, Any]]:
        """Backtrack from head (or stop_at) along parent_id, returning root→leaf path.

        Old data without parent / message_id is chained linearly by seq.
        """
        if not messages:
            return []
        ordered = sorted(
            messages,
            key=lambda m: int(m.get("seq") or 0) if str(m.get("seq") or "").strip() else 0,
        )
        # Synthesize stable id + linear parent, ensuring fallback to full transcript when tree fields are absent
        by_id: dict[str, dict[str, Any]] = {}
        prev_id = ""
        for index, raw in enumerate(ordered):
            mid = str(raw.get("message_id") or "").strip() or f"__seq_{raw.get('seq', index)}"
            pid = str(raw.get("parent_id") or "").strip()
            if not pid and prev_id:
                pid = prev_id
            node = {**raw, "message_id": mid, "parent_id": pid}
            by_id[mid] = node
            prev_id = mid

        start_id = (stop_at or head_id or "").strip()
        if not start_id:
            start_id = prev_id
        cur = by_id.get(start_id)
        if cur is None and ordered:
            cur = by_id.get(prev_id)
        chain: list[dict[str, Any]] = []
        guard = 0
        while cur is not None and guard <= len(messages) + 2:
            chain.append(cur)
            guard += 1
            pid = str(cur.get("parent_id") or "").strip()
            cur = by_id.get(pid) if pid else None
        chain.reverse()
        return chain

    def load_transcript(
        conversation_id: str,
        *,
        stop_at: str = "",
    ) -> list[dict[str, Any]]:
        if not conversation_id or rust is None:
            return []
        try:
            detail = rust.get_conversation(conversation_id) or {}
        except Exception:
            return []
        messages = list(detail.get("messages") or [])
        head_id = str(detail.get("head_id") or "").strip()
        path = _visible_path(messages, head_id, stop_at=stop_at)
        out: list[dict[str, Any]] = []
        for message in path:
            role = str(message.get("role") or "")
            content = str(message.get("content") or "")
            if role not in {"user", "assistant"} or not content.strip():
                continue
            out.append(
                {
                    "role": role,
                    "content": content,
                    "message_id": str(message.get("message_id") or ""),
                    "parent_id": str(message.get("parent_id") or ""),
                    "citations_json": message.get("citations_json") or "[]",
                }
            )
        return out

    def prepare_memory(
        conversation_id: str,
        *,
        force_compress: bool = False,
        stop_at: str = "",
    ) -> tuple[list[dict[str, str]], dict[str, Any] | None, dict[str, Any], str]:
        """Compress (optional) + assemble history; returns (history, compress_event|None, memory_debug, summary_id).

        When summary_id is non-empty, the caller must attach this turn's user (or regenerate assistant)
        under it -- only when the summary lands on the head path can load_transcript read it back next round.
        Old implementation hung summary with set_head=False under head, and user also under head,
        making summary a sibling of user (dead branch): never readable back -> re-compress every round + write another
        orphan summary (Audit A2).
        """
        transcript = load_transcript(conversation_id, stop_at=stop_at)
        compress = maybe_compress_transcript(
            transcript,
            window_turns=settings.memory_window_turns,
            compress_after_turns=settings.memory_compress_after_turns,
            force=force_compress,
        )
        compress_event: dict[str, Any] | None = None
        summary_id = ""
        working = compress.messages
        if compress.compressed and compress.summary_message and conversation_id and rust is not None:
            try:
                summary_msg = rust.append_conversation_message(
                    conversation_id,
                    role="assistant",
                    content=str(compress.summary_message.get("content") or ""),
                    model="memory/extractive_v1",
                    parent_id=stop_at or "",
                    set_head=False,
                )
                summary_id = str((summary_msg or {}).get("message_id") or "").strip()
                compress_event = compress.event
            except Exception as exc:
                print(f"[retainpdf-ai] persist summary failed: {exc}", flush=True)
                # Persist failure: still complete this round using the in-memory working view
        assembled = assemble_history(
            working,
            window_turns=settings.memory_window_turns,
            max_chars=settings.memory_max_chars,
        )
        debug = {
            **assembled.debug,
            "compressed": bool(compress.compressed and compress_event is not None),
            "evidence_count": 0,
        }
        return assembled.history, compress_event, debug, summary_id

    def persist_turn(
        conversation_id: str,
        payload: AskInput,
        result: Any,
        *,
        chain_parent_id: str = "",
    ) -> None:
        """Best-effort history write-back: failure is only logged, does not affect the response.

        Normal turn: user(parent=chain_parent_id|payload.parent_id|head) + assistant(parent=user).
        Regenerate: only assistant(parent=chain_parent_id|payload.parent_id user node).
        chain_parent_id = summary node id just persisted by prepare_memory: when passed, this turn's messages use
        the summary as parent, linking the summary into the head path (otherwise summary becomes a dead branch, see prepare_memory comment).

        Returns whether persistence succeeded (no conversation to write = True, not a failure); False is passed through
        via done.persisted to inform the frontend "this turn was not saved to history" (Audit C2: previously failures were only printed, invisible to users).
        """
        if not conversation_id or rust is None:
            return True
        try:
            parent_hint = chain_parent_id.strip() or payload.parent_id.strip()
            citations_json = json.dumps(
                [asdict(citation) for citation in result.citations], ensure_ascii=False
            )
            tool_trace_json = json.dumps(result.tool_trace, ensure_ascii=False)
            model = payload.llm_model or settings.llm_model
            if payload.regenerate:
                # Retry: parent_id must be a user message
                user_parent = parent_hint
                rust.append_conversation_message(
                    conversation_id,
                    role="assistant",
                    content=result.answer,
                    citations_json=citations_json,
                    tool_trace_json=tool_trace_json,
                    model=model,
                    parent_id=user_parent,
                    message_id=payload.assistant_message_id.strip(),
                    set_head=True,
                )
                return True
            user_msg = rust.append_conversation_message(
                conversation_id,
                role="user",
                content=payload.question.strip(),
                parent_id=parent_hint,
                message_id=payload.user_message_id.strip(),
                set_head=True,
            )
            user_id = str((user_msg or {}).get("message_id") or "").strip()
            rust.append_conversation_message(
                conversation_id,
                role="assistant",
                content=result.answer,
                citations_json=citations_json,
                tool_trace_json=tool_trace_json,
                model=model,
                parent_id=user_id or parent_hint,
                message_id=payload.assistant_message_id.strip(),
                set_head=True,
            )
            return True
        except Exception as exc:
            print(f"[retainpdf-ai] persist conversation turn failed: {exc}", flush=True)
            return False

    def require_api_key(request: Request) -> None:
        if not settings.api_keys:
            raise HTTPException(status_code=500, detail="RETAIN_AI_API_KEYS is not configured")
        provided = request.headers.get("X-API-Key", "")
        if provided not in settings.api_keys:
            raise HTTPException(status_code=401, detail="invalid api key")

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"ok": True, "version": __version__}

    def _result_payload(
        result: Any,
        *,
        conversation_id: str = "",
        memory: dict[str, Any] | None = None,
        persisted: bool = True,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "answer": result.answer,
            "citations": [asdict(citation) for citation in result.citations],
            "tool_trace": result.tool_trace,
            "rounds": result.rounds,
            "persisted": persisted,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        if memory:
            payload["memory"] = memory
        return payload

    def _resolve_llm_settings(payload: AskInput) -> Settings:
        # When frontend passes LLM key/base/model per-request, override startup config; fall back to env if all three are empty.
        # Missing key is rejected immediately to avoid hitting upstream and getting 401.
        api_key = (payload.llm_api_key or settings.llm_api_key).strip()
        if not api_key:
            raise HTTPException(status_code=400, detail="缺少 LLM API Key:请在前端凭据设置中填写模型 API Key。")
        return replace(
            settings,
            llm_api_key=api_key,
            llm_base_url=(payload.llm_base_url or settings.llm_base_url).rstrip("/"),
            llm_model=payload.llm_model or settings.llm_model,
        )

    def _request_chat_fn(payload: AskInput):
        # Non-streaming path: fall back to startup chat_fn (returns None) when the request does not override any LLM params.
        resolved = _resolve_llm_settings(payload)  # Also guards against missing key
        if not payload.llm_api_key and not payload.llm_base_url and not payload.llm_model:
            return None
        return build_deepseek_chat_fn(resolved)

    def _sse_events(payload: AskInput, resolved: Settings) -> Iterator[str]:
        # The agent loop is synchronous blocking; offload to a worker thread and push events via queue --
        # frontend sees a "searching..." sense of progress within ~2s of the first tool call;
        # final answer round streams answer_delta token-by-token via on_delta.
        events: queue.Queue[dict[str, Any] | None] = queue.Queue()
        document_id = resolve_document_id(payload)
        conversation_id = ensure_conversation_id(payload, document_id)
        # regenerate: context stops at user node; normal continuation: follow current head path
        memory_stop = (
            payload.parent_id.strip()
            if payload.regenerate and payload.parent_id.strip()
            else ""
        )
        history, compress_event, memory_debug, summary_id = prepare_memory(
            conversation_id,
            force_compress=bool(payload.force_compress),
            stop_at=memory_stop,
        )
        # SSE path always uses streaming chat_fn with on_delta: incremental text goes into the event queue.
        chat_fn = build_deepseek_chat_fn(
            resolved,
            on_delta=lambda text: events.put({"type": "answer_delta", "text": text}),
        )

        def run() -> None:
            try:
                if compress_event:
                    events.put(compress_event)
                result = agent.ask(
                    payload.question,
                    document_id=document_id,
                    job_id=payload.job_id.strip(),
                    on_event=events.put,
                    chat_fn=chat_fn,
                    history=history,
                )
                persisted = persist_turn(conversation_id, payload, result, chain_parent_id=summary_id)
                events.put(
                    {
                        "type": "done",
                        **_result_payload(
                            result,
                            conversation_id=conversation_id,
                            memory=memory_debug,
                            persisted=persisted,
                        ),
                    }
                )
            except Exception as exc:
                # RuntimeError is our own user-readable text (e.g. _friendly_llm_error),
                # emit as-is without exception class name; other exceptions keep the class name for easier diagnosis.
                message = str(exc) if isinstance(exc, RuntimeError) else f"{type(exc).__name__}: {exc}"
                events.put({"type": "error", "message": message})
            finally:
                events.put(None)

        threading.Thread(target=run, daemon=True).start()
        while True:
            event = events.get()
            if event is None:
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    @app.post("/v1/ask", dependencies=[Depends(require_api_key)])
    def ask(payload: AskInput) -> Any:
        if payload.stream:
            # HTTPException thrown inside a generator cannot become 400, so validate and resolve settings here first.
            resolved = _resolve_llm_settings(payload)
            return StreamingResponse(
                _sse_events(payload, resolved),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        chat_fn = _request_chat_fn(payload)
        document_id = resolve_document_id(payload)
        conversation_id = ensure_conversation_id(payload, document_id)
        memory_stop = (
            payload.parent_id.strip()
            if payload.regenerate and payload.parent_id.strip()
            else ""
        )
        history, _compress_event, memory_debug, summary_id = prepare_memory(
            conversation_id,
            force_compress=bool(payload.force_compress),
            stop_at=memory_stop,
        )
        result = agent.ask(
            payload.question,
            document_id=document_id,
            job_id=payload.job_id.strip(),
            chat_fn=chat_fn,
            history=history,
        )
        persisted = persist_turn(conversation_id, payload, result, chain_parent_id=summary_id)
        return {
            "code": 0,
            "message": "ok",
            "data": _result_payload(
                result,
                conversation_id=conversation_id,
                persisted=persisted,
                memory=memory_debug,
            ),
        }

    return app

















