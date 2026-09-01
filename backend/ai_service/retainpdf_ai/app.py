"""FastAPI 应用:认证 + /v1/ask + 健康检查。"""

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
    # 可只传 job_id(含历史 run):由服务端解析所属文档,避免前端靠
    # active_job_id 反查在历史 job 上静默失配、问答退化为全库检索
    job_id: str = ""
    # 多轮对话:传会话 ID 则注入既往轮次为上下文,并在完成后把
    # user/assistant 两条经 Rust API 回写(单写入者不破)。
    # 缺省时若能连上 Rust 会 auto-create,并在 done 回传 conversation_id。
    conversation_id: str = ""
    # 消息树:新 user 的 parent(当前 head);重试时 = 被重试的 user 消息 id。
    parent_id: str = ""
    # 重新生成:只挂新 assistant 到 parent_id(user),不再写 user。
    regenerate: bool = False
    # 客户端稳定消息 id,与前端 store / assistant-ui 对齐。
    user_message_id: str = ""
    assistant_message_id: str = ""
    stream: bool = False
    # B2: 强制触发抽取式压缩（测试/调试）
    force_compress: bool = False
    # 前端按请求传入的 LLM 凭据:留空则回退启动期 env 配置
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
        # LLM key 不再强制:允许留空 env,由前端按请求传入(见 AskInput.llm_api_key)
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
        """B1: 有 conversation_id 则用;否则经 Rust auto-create 并返回新 id。"""
        existing = payload.conversation_id.strip()
        if existing:
            return existing
        if rust is None:
            return ""
        title = (payload.question or "").strip().replace("\n", " ")
        if len(title) > 48:
            title = f"{title[:48].rstrip()}…"
        if not title:
            title = "阅读问答"
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
        """从 head(或 stop_at)沿 parent_id 回溯,返回根→叶路径。

        无 parent / message_id 的旧数据按 seq 串成线性链。
        """
        if not messages:
            return []
        ordered = sorted(
            messages,
            key=lambda m: int(m.get("seq") or 0) if str(m.get("seq") or "").strip() else 0,
        )
        # 合成稳定 id + 线性 parent,保证无树字段时退化为整条 transcript
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
        """压缩(可选) + 组装 history；返回 (history, compress_event|None, memory_debug, summary_id)。

        summary_id 非空时,调用方必须把本轮 user(或 regenerate 的 assistant)挂在
        它下面——摘要只有落在 head 路径上,下一轮 load_transcript 才读得回来。
        旧实现摘要以 set_head=False 挂在 head 下、user 又同样挂在 head 下,
        摘要成了 user 的兄弟节点(死分支):永远读不回 → 每轮重新压缩 + 再写一条
        孤儿摘要(审计 A2)。
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
                # 持久化失败仍用内存 working 视图完成本轮
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
        """尽力而为的历史回写:失败只记日志,不影响返回。

        正常轮: user(parent=chain_parent_id|payload.parent_id|head) + assistant(parent=user)。
        regenerate: 仅 assistant(parent=chain_parent_id|payload.parent_id 的 user 节点)。
        chain_parent_id = prepare_memory 刚落库的摘要节点 id:传入时本轮消息以
        摘要为 parent,把摘要接进 head 路径(否则摘要成死分支,见 prepare_memory 注释)。

        返回是否成功持久化(无会话可写=True,不算失败);False 会经 done.persisted
        透传给前端提示"本轮未存入历史"(审计 C2:此前失败只 print,用户无感知)。
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
                # 重试: parent_id 必须是 user 消息
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
        # 前端按请求携带 LLM key/base/model 时覆盖启动期配置;三者留空则回退 env。
        # 缺 key 直接报错,避免打到上游才 401。
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
        # 非流式路径:请求未覆盖任何 LLM 参数时回退启动期 chat_fn(返回 None)。
        resolved = _resolve_llm_settings(payload)  # 顺带做缺 key 守卫
        if not payload.llm_api_key and not payload.llm_base_url and not payload.llm_model:
            return None
        return build_deepseek_chat_fn(resolved)

    def _sse_events(payload: AskInput, resolved: Settings) -> Iterator[str]:
        # agent 循环是同步阻塞的,放到工作线程,经队列推事件——
        # 前端在首个工具调用(~2s)就能看到"正在检索…"的过程感;
        # 最终回答轮经 on_delta 逐 token 推 answer_delta。
        events: queue.Queue[dict[str, Any] | None] = queue.Queue()
        document_id = resolve_document_id(payload)
        conversation_id = ensure_conversation_id(payload, document_id)
        # regenerate: 上下文停在 user 节点;正常续写:走当前 head 路径
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
        # SSE 路径总是用带 on_delta 的流式 chat_fn:增量文本进事件队列。
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
                # RuntimeError 是我们自己产的用户可读文案（如 _friendly_llm_error），
                # 直出不带异常类名；其余异常保留类名便于定位
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
            # 生成器内抛 HTTPException 无法转成 400,故先在此校验并解析出 settings
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
