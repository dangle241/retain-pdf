"""FastAPI Apply:Authentication + /v1/ask + Health check."""

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
    # Pass only job_id(Includes history run):Server parses owning document.,Avoid frontend reliance
    # active_job_id Reverse lookup in history job Silent mismatch upstream; QA degrades to full-library retrieval.
    job_id: str = ""
# Multi-turn dialogue: pass session ID, injects previous rounds as context, and upon completion
    # user/assistant Two meridians Rust API Write-back(Single writer, no corruption.)Multi-turn dialogue: providing conversation ID injects previous turns as context, and writes back user/assistant messages via Rust API upon completion (single writer prevents corruption). If omitted and Rust is connected, it auto-creates and returns conversation_id on done.
    # Connects by default. Rust will auto-create,and done Callback conversation_id。
    conversation_id: str = ""
# Message tree: new user's parent (current head); retry: = retried user message id.
    parent_id: str = ""
    # No input provided. Need source text to translate.:Mount new only assistant to parent_id(user),Stop writing user。
    regenerate: bool = False
    # Client stable message id,With frontend store / assistant-ui Align.
    user_message_id: str = ""
    assistant_message_id: str = ""
    stream: bool = False
    # B2: Force trigger extractive compression (test/debug)
    force_compress: bool = False
    # Frontend passes in via request LLM Credentials:Leave blank to revert to startup phase. env Config
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
# LLM key no longer mandatory: allow blank env, passed by frontend per request. (see AskInput.llm_api_key)
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
        """B1: has conversation_id then use;Otherwise via Rust auto-create and return new id。"""
        existing = payload.conversation_id.strip()
        if existing:
            return existing
        if rust is None:
            return ""
        title = (payload.question or "").strip().replace("\n", " ")
        if len(title) > 48:
            title = f"{title[:48].rstrip()}…"
        if not title:
            title = "reading Q&A"
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
"""From head (or stop_at) backtrack along parent_id, return rootâLeaf path.

        none parent / message_id by old data seq Link into linear chain.
        """
        if not messages:
            return []
        ordered = sorted(
            messages,
            key=lambda m: int(m.get("seq") or 0) if str(m.get("seq") or "").strip() else 0,
        )
        # Synthetic stability id + Linear parent,Fallback to full record if no tree fields. transcript
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
        """Compress(Optional) + Assemble history; return (history, compress_event|None, memory_debug, summary_id)。

summary_id If non-empty,The caller must process this round. user(or regenerate's assistant)Hung
        Below——Summary only falls within head on path,Next round load_transcript Just managed to read it back.
Old implementation summary with set_head=False hung under head belowuser also attached under head,
        Summary complete. user Sibling node(Dead branch):Never read back → Re‑compress every round + write another one
        Orphan Summary(Audit A2)。
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
                # Persistence failed; fallback to memory. working use memory working view to complete this round
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
        """Best-effort history write-back.:Log only on failure.,Does not affect return.

        Normal Round: user(parent=chain_parent_id|payload.parent_id|head) + assistant(parent=user)。
regenerate: only assistant(parent=chain_parent_id|payload.parent_id's user Node).
        chain_parent_id = prepare_memory Just-landed summary node id:On input, current message round uses
        Summary: parent,Integrate the summary. head Path(otherwise the summary becomes a dead branch,see prepare_memory Comments)。

        Return whether persistence succeeded.(No session to write=True,Not a failure.);False Meeting Manager done.persisted
Forward prompt to frontend."This round not saved to history."(audit C2:Only previous failures print,User-transparent.).
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
# Retry: parent_id Must be user message
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
        # Frontend sends per request LLM key/base/model Override startup config;Fallback if all three empty. env。
        # Missing key Raise error directly,Avoid hitting upstream. 401。
        api_key = (payload.llm_api_key or settings.llm_api_key).strip()
        if not api_key:
            raise HTTPException(status_code=400, detail="Missing LLM API Key:Please fill in the model API Key in the frontend credentials settings. API Key。")
        return replace(
            settings,
            llm_api_key=api_key,
            llm_base_url=(payload.llm_base_url or settings.llm_base_url).rstrip("/"),
            llm_model=payload.llm_model or settings.llm_model,
        )

    def _request_chat_fn(payload: AskInput):
# Non-streaming path: request does not override any LLM fallback to startup period on parameter error. chat_fn returns None.
        resolved = _resolve_llm_settings(payload)  # Also guard against missing keys key Guard
        if not payload.llm_api_key and not payload.llm_base_url and not payload.llm_model:
            return None
        return build_deepseek_chat_fn(resolved)

    def _sse_events(payload: AskInput, resolved: Settings) -> Iterator[str]:
        # agent Loop is synchronous and blocking.,Move to worker thread.,Push event via queue——
        # Frontend on first tool call(~2s)visible"Retrieving…"sense of process;
# Final answer round completed. on_delta pushes answer_delta token by token.
        events: queue.Queue[dict[str, Any] | None] = queue.Queue()
        document_id = resolve_document_id(payload)
        conversation_id = ensure_conversation_id(payload, document_id)
        # regenerate: Context halts at user Node;No context. Provide code or prompt to continue.:follow current head path
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
        # SSE SSE path always uses streaming chat_fn with on_delta: incremental text enters event queue. on_delta streaming chat_fn:Enqueue incremental text.
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
                # RuntimeError User-facing strings we generate (e.g. _friendly_llm_errorInvalid input.
                # Direct output omits exception class name; other exceptions retain it for localization.
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
            # Throw inside generator HTTPException Cannot convert to 400,Validate and parse here first. settings
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
