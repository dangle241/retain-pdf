"""Extractive Context Compression extractive_v1: does not call LLM, fold early rounds by rules."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

SUMMARY_PREFIX = "【Conversation summary】"
CITATION_RE = re.compile(r"\[(\d+)\]")


@dataclass
class CompressResult:
    """Compression result.summary_message When non-empty, caller should persist and notify frontend."""

    messages: list[dict[str, Any]]
    compressed: bool = False
    summary_message: dict[str, str] | None = None
    event: dict[str, Any] = field(default_factory=dict)


def is_summary_message(message: dict[str, Any]) -> bool:
    content = str(message.get("content") or "").strip()
    return content.startswith(SUMMARY_PREFIX)


def split_transcript(
    messages: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
"""Returns (latest summary message or None, messages after this summary turn)."""
    last_summary: dict[str, Any] | None = None
    last_summary_idx = -1
    for index, message in enumerate(messages):
        if is_summary_message(message):
            last_summary = message
            last_summary_idx = index
    turns = [
        message
        for message in messages[last_summary_idx + 1 :]
        if str(message.get("role") or "") in {"user", "assistant"}
        and str(message.get("content") or "").strip()
        and not is_summary_message(message)
    ]
    return last_summary, turns


def count_turns(messages: list[dict[str, Any]]) -> int:
"""Rough estimate of turns: user count."""
    return sum(1 for m in messages if str(m.get("role") or "") == "user")


def _clip(text: str, max_chars: int) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 1].rstrip()}…"


def build_extractive_summary(turns: list[dict[str, Any]], *, max_chars: int = 1800) -> str:
    """From collapsed turns Extract issue / Conclusion with references / Evidence snippet."""
    user_questions: list[str] = []
    cited_lines: list[str] = []
    evidence_lines: list[str] = []

    for message in turns:
        role = str(message.get("role") or "")
        content = str(message.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            user_questions.append(_clip(content, 120))
            continue
        if role == "assistant":
            for line in content.splitlines():
                line = line.strip()
                if line and CITATION_RE.search(line):
                    cited_lines.append(_clip(line, 160))
            citations_raw = message.get("citations_json") or message.get("citations") or ""
            if isinstance(citations_raw, str) and citations_raw.strip().startswith("["):
                try:
                    import json

                    items = json.loads(citations_raw)
                except Exception:
                    items = []
            elif isinstance(citations_raw, list):
                items = citations_raw
            else:
                items = []
            for item in items[:8]:
                if not isinstance(item, dict):
                    continue
                ref = item.get("ref", "?")
                page = item.get("page_idx")
                if isinstance(page, int) or (isinstance(page, str) and str(page).isdigit()):
                    page_label = f"p.{int(page) + 1}"
                else:
                    page_label = ""
                snippet = _clip(str(item.get("snippet") or ""), 80)
                block = str(item.get("block_id") or "").strip()
                parts = [f"[{ref}]", page_label, block, snippet]
                evidence_lines.append(" ".join(p for p in parts if p))

    lines = [SUMMARY_PREFIX, "- User concerns:"]
    if user_questions:
        for q in user_questions[-8:]:
            lines.append(f"  · {q}")
    else:
        lines.append("  · (none)")

    lines.append("- Confirmed conclusion (with citations):")
    if cited_lines:
        for line in cited_lines[-10:]:
            lines.append(f"  · {line}")
    else:
        lines.append("  · (early answers not annotated [n](only the topic is retained)")

    lines.append("- Key evidence:")
    if evidence_lines:
        # Deduplicate preserving order.
        seen: set[str] = set()
        for line in evidence_lines:
            if line in seen:
                continue
            seen.add(line)
            lines.append(f"  · {line}")
            if len(seen) >= 12:
                break
    else:
        lines.append("  · Unstructured. citations）")

    text = "\n".join(lines)
    if len(text) > max_chars:
        text = f"{text[: max_chars - 1].rstrip()}…"
    return text


def maybe_compress_transcript(
    messages: list[dict[str, Any]],
    *,
    window_turns: int = 6,
    compress_after_turns: int = 12,
    force: bool = False,
    summary_max_chars: int = 1800,
) -> CompressResult:
    """
if turn count exceeds threshold or forced, then place the latest summary outside the window.
    Collapse to one line. assistant Summarize message.

Returned messages are the **logical transcript** memory view.
    [Optional old summary] + [new summary] + [Recent Windows turns]
    Caller responsible for new. summary Write Rust。
    """
    normalized = [
        {
            "role": str(m.get("role") or ""),
            "content": str(m.get("content") or ""),
            "citations_json": m.get("citations_json") or m.get("citations") or "[]",
        }
        for m in messages
        if str(m.get("role") or "") in {"user", "assistant"}
        and str(m.get("content") or "").strip()
    ]
    last_summary, turns = split_transcript(normalized)
    turn_count = count_turns(turns)
    window_turns = max(1, int(window_turns))
    compress_after_turns = max(window_turns + 1, int(compress_after_turns))

    if not force and turn_count <= compress_after_turns:
        return CompressResult(messages=normalized, compressed=False)

    # Keep recent window_turns items user Active round → approx. 2*window message
    keep_n = window_turns * 2
    if len(turns) <= keep_n:
        # Force compress but window already covers all → Still summarize entire block, keeping only window (empty fold).
        if not force:
            return CompressResult(messages=normalized, compressed=False)
        # force: Generate full coverage turns Summary, window retains recent keep_n
        to_fold = turns[:-keep_n] if len(turns) > keep_n else turns[:]
        kept = turns[-keep_n:] if len(turns) > keep_n else turns[:]
    else:
        to_fold = turns[:-keep_n]
        kept = turns[-keep_n:]

    if not to_fold:
        return CompressResult(messages=normalized, compressed=False)

    summary_text = build_extractive_summary(to_fold, max_chars=summary_max_chars)
    summary_message = {"role": "assistant", "content": summary_text}
# New transcript: discard old summary collapsed turns, keep the new summary + window
    # (old summary Info likely integrated. to_fold early content; if to_fold Excludes legacy summary Text,
    #  Migrate legacy summary Prepend to summary header to prevent loss.
    if last_summary and str(last_summary.get("content") or "").strip():
        prior = str(last_summary.get("content") or "").strip()
        if prior not in summary_text:
            summary_text = f"{prior}\n\n——\n\n{summary_text}"
            summary_message["content"] = summary_text

    new_messages = [summary_message, *kept]
    dropped_turns = count_turns(to_fold)
    event = {
        "type": "compress",
        "dropped_turns": dropped_turns,
        "summary_chars": len(summary_text),
        "kept_evidence": summary_text.count("["),
        "policy": "extractive_v1",
        "window_turns": window_turns,
    }
    return CompressResult(
        messages=new_messages,
        compressed=True,
        summary_message=summary_message,
        event=event,
    )
