import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent import RetrievalAgent
from retainpdf_ai.tools import Tool, ToolRegistry


def _search_tool(hits):
    def handler(arguments):
        selected = [dict(hit) for hit in hits]
        doc = str(arguments.get("document_id") or "").strip()
        if doc:
            selected = [h for h in selected if h.get("document_id") == doc]
        return {"hits": selected, "document_id": doc or None, "args": dict(arguments)}

    return Tool(
        name="search_fulltext",
        description="Search",
        parameters={"type": "object", "properties": {"query": {"type": "string"}}},
        handler=handler,
    )


HITS = [
    {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 3,
        "block_id": "p004-b0002",
        "translated_snippet": "Reaction rate significantly increased.",
    },
    {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 7,
        "block_id": "p008-b0001",
        "translated_snippet": "Selectivity from conjugation effect.",
    },
]


def _tool_call(name, arguments, call_id="call-1"):
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments, ensure_ascii=False)},
    }


def test_agent_runs_tools_then_answers_with_cited_anchors():
    registry = ToolRegistry([_search_tool(HITS)])
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "selectivity"})]},
            {"content": "选择性来自共轭效应 [2]。", "tool_calls": []},
        ]
    )
    seen_tool_messages = []

    def fake_chat(messages, tools):
        seen_tool_messages.extend(m for m in messages if m["role"] == "tool")
        return next(script)

    agent = RetrievalAgent(registry, fake_chat, max_tool_rounds=4)
    result = agent.ask("Selective why? Feature flag toggle. Remove flag.?")

    assert result.rounds == 2
assert result.answer == "Selectivity comes from the conjugation effect [2]."
    # Return only referenced anchors,ID written to model-visible tool result.
    assert [citation.ref for citation in result.citations] == [2]
    assert result.citations[0].block_id == "p008-b0001"
    payload = json.loads(seen_tool_messages[0]["content"])
    assert payload["hits"][0]["ref"] == 1
    assert result.tool_trace == [
        {"round": 1, "tool": "search_fulltext", "arguments": {"query": "选择性"}}
    ]


def test_agent_forces_document_id_into_search_tools():
    """Entire Book Q&A:even if model not passed document_id,agent Also force inject."""
    seen_args = []

    def capture(arguments):
        seen_args.append(dict(arguments))
        return {"hits": [dict(HITS[0])]}

    registry = ToolRegistry(
        [
            Tool(
                name="search_fulltext",
description="Search",
                parameters={"type": "object", "properties": {"query": {"type": "string"}}},
                handler=capture,
            )
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "选择性"})]},
            {"content": "Answer [1]。", "tool_calls": []},
        ]
    )
    agent = RetrievalAgent(registry, lambda m, t: next(script), max_tool_rounds=4)
    result = agent.ask("Why?", document_id="doc-a", job_id="job-1")
    assert seen_args[0]["query"] == "Selective"
    assert seen_args[0]["document_id"] == "doc-a"
    assert result.tool_trace[0]["arguments"]["document_id"] == "doc-a"


def test_agent_falls_back_to_all_citations_when_answer_has_no_markers():
    registry = ToolRegistry([_search_tool(HITS)])
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "rate"})]},
            {"content": "Faster and selective.", "tool_calls": []},
        ]
    )
    agent = RetrievalAgent(registry, lambda m, t: next(script), max_tool_rounds=4)
    result = agent.ask("Conclusion?")
    assert [citation.ref for citation in result.citations] == [1, 2]


def test_agent_forces_final_answer_when_rounds_exhausted():
    registry = ToolRegistry([_search_tool(HITS)])
    calls = {"n": 0}

    def looping_chat(messages, tools):
        calls["n"] += 1
        if tools:
            return {
                "content": "",
                "tool_calls": [_tool_call("search_fulltext", {"query": f"q{calls['n']}"})],
            }
        # Final call omits tools.
        assert messages[-1]["role"] == "user"
        return {"content": "Final answer based on existing evidence. [1]。", "tool_calls": []}

    agent = RetrievalAgent(registry, looping_chat, max_tool_rounds=3)
    result = agent.ask("Search history persists. Browser stores queries. Clear history or use incognito.")
    assert result.rounds == 3
    assert "final answer" in result.answer
    assert len(result.tool_trace) == 3


def test_friendly_llm_error_maps_status_codes():
"""Audit C1:402/429/401 must be translated into user-actionable Chinese,Truncate upstream details."""
    from retainpdf_ai.agent import _friendly_llm_error

assert "Insufficient balance" in str(_friendly_llm_error(402))
assert "rate limiting" in str(_friendly_llm_error(429))
    assert "Key Invalid" in str(_friendly_llm_error(401))
    assert "Upstream failure." in str(_friendly_llm_error(503))
    long_detail = "x" * 500
    msg = str(_friendly_llm_error(402, long_detail))
    assert len(msg) < 300
    assert "…" in msg


def test_rounds_exhausted_final_call_uses_request_level_chat_fn():
"""Audit A1 Regression lock:env not configured key(Startup chat=_missing_key Form)pass chat_fn per request
chat_fn when,Rounds exhausted: final round must still use request-level. chat_fn,instead of self._chat."""
    registry = ToolRegistry([_search_tool(HITS)])

    def startup_chat_missing_key(_messages, _tools):
raise RuntimeError("Missing LLM API Key")

    calls = {"n": 0}

    def request_chat(messages, tools):
        calls["n"] += 1
        if tools:
            return {
                "content": "",
                "tool_calls": [_tool_call("search_fulltext", {"query": f"q{calls['n']}"})],
            }
        return {"content": "Request-level key final answer [1]。", "tool_calls": []}

    agent = RetrievalAgent(registry, startup_chat_missing_key, max_tool_rounds=2)
result = agent.ask("the question I've always wanted to search for", chat_fn=request_chat)
    assert result.rounds == 2
    assert "final answer" in result.answer


def test_unknown_tool_and_handler_error_feed_back_to_model():
    def boom(_arguments):
        raise RuntimeError("backend down")

    registry = ToolRegistry(
        [
            Tool(
                name="broken",
                description="always fails",
                parameters={"type": "object", "properties": {}},
                handler=boom,
            )
        ]
    )
    script = iter(
        [
            {
                "content": "",
                "tool_calls": [
                    _tool_call("broken", {}, "c1"),
                    _tool_call("missing", {}, "c2"),
                ],
            },
            {"content": "All tools failed.,Cannot answer.", "tool_calls": []},
        ]
    )
    captured = []

    def fake_chat(messages, tools):
        captured.extend(m for m in messages if m["role"] == "tool")
        return next(script)

    agent = RetrievalAgent(registry, fake_chat, max_tool_rounds=3)
    result = agent.ask("q")
assert result.answer.startswith("all tools failed")
    errors = [json.loads(m["content"]) for m in captured]
    assert any("backend down" in str(e.get("error")) for e in errors)
    assert any("unknown tool" in str(e.get("error")) for e in errors)


def _sse(chunks):
    import json as _json
    lines = [f"data: {_json.dumps(c, ensure_ascii=False)}" for c in chunks]
    lines.append("data: [DONE]")
    return lines


def _content_chunk(text):
    return {"choices": [{"delta": {"content": text}}]}


def _tool_chunk():
    return {"choices": [{"delta": {"tool_calls": [
        {"index": 0, "id": "c1", "type": "function",
         "function": {"name": "search_fulltext", "arguments": "{}"}}
    ]}}]}


def test_streaming_tool_turn_preamble_not_emitted_as_answer_delta():
"""Audit A3 regression lock:Tool Wheel's content Preface must not be leaked. answer_delta."""
    from retainpdf_ai.agent import assemble_streaming_message

    deltas = []
    message = assemble_streaming_message(
        _sse([_content_chunk("Let me first"), _content_chunk("Search…"), _tool_chunk()]),
        on_delta=deltas.append,
    )
    assert deltas == [], f"Tool wheel preamble leak: {deltas}"
    assert message["tool_calls"][0]["function"]["name"] == "search_fulltext"
    # content Remains in message in(Context sent to model complete.)
assert "search a bit" in message["content"]


def test_streaming_pure_answer_still_streams_and_short_answer_flushes():
    from retainpdf_ai.agent import assemble_streaming_message

    # Long answer.:Full 64 Convert to pass-through after character classification.
    long_piece = "answer" * 64
    deltas = []
    assemble_streaming_message(
        _sse([_content_chunk(long_piece), _content_chunk("Tail")]),
        on_delta=deltas.append,
    )
assert "".join(deltas) == long_piece + "tail"
    assert len(deltas) == 2, "After classification, proceed step by step. piece Direct"

    # Short answer:Below threshold,Resend all at stream end.
    deltas2 = []
    assemble_streaming_message(_sse([_content_chunk("Short answer")]), on_delta=deltas2.append)
assert "".join(deltas2) == "Short answer"
