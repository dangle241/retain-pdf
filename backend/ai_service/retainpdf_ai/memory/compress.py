"""Extractive context compression extractive_v1: no LLM call, rule-based folding of early turns."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

SUMMARY_PREFIX = "【对话摘要】"
CITATION_RE = re.compile(r"\[(\d+)\]")


@dataclass
class CompressResult:
    """Compression result; when summary_message is non-empty the caller should persist and notify the frontend."""

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
    """Return (latest summary message or None, turn messages after that summary)."""
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
    """Rough turn count: number of user messages."""
    return sum(1 for m in messages if str(m.get("role") or "") == "user")


def _clip(text: str, max_chars: int) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 1].rstrip()}…"


def build_extractive_summary(turns: list[dict[str, Any]], *, max_chars: int = 1800) -> str:
    """Extract questions / cited conclusions / evidence snippets from the folded turns."""
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

    lines = [SUMMARY_PREFIX, "- 用户关注："]
    if user_questions:
        for q in user_questions[-8:]:
            lines.append(f"  · {q}")
    else:
        lines.append("  · （无）")

    lines.append("- 已确认结论（含引用）：")
    if cited_lines:
        for line in cited_lines[-10:]:
            lines.append(f"  · {line}")
    else:
        lines.append("  · （早期回答未标注 [n]，仅保留主题）")

    lines.append("- 重要证据：")
    if evidence_lines:
        # Deduplicate while preserving order
        seen: set[str] = set()
        for line in evidence_lines:
            if line in seen:
                continue
            seen.add(line)
            lines.append(f"  · {line}")
            if len(seen) >= 12:
                break
    else:
        lines.append("  · （无结构化 citations）")

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
    If turn count exceeds the threshold or force is set, fold early turns outside the window
    (after the latest summary) into a single assistant summary message.

    Returned messages are the **logical transcript** (in-memory view):
    [optional old summary] + [new summary] + [recent window turns]
    The caller is responsible for writing the new summary to Rust.
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

    # Keep the most recent window_turns user-initiated rounds -> about 2*window messages
    keep_n = window_turns * 2
    if len(turns) <= keep_n:
        # Force compression but window already covers everything -> can still summarize all then keep only window (empty fold)
        if not force:
            return CompressResult(messages=normalized, compressed=False)
        # force: generate summary covering all turns, window still keeps the most recent keep_n
        to_fold = turns[:-keep_n] if len(turns) > keep_n else turns[:]
        kept = turns[-keep_n:] if len(turns) > keep_n else turns[:]
    else:
        to_fold = turns[:-keep_n]
        kept = turns[-keep_n:]

    if not to_fold:
        return CompressResult(messages=normalized, compressed=False)

    summary_text = build_extractive_summary(to_fold, max_chars=summary_max_chars)
    summary_message = {"role": "assistant", "content": summary_text}
    # New transcript: drop old summary and folded turns, keep new summary + window
    # (Old summary info may already be merged into early content of to_fold; if to_fold does not contain old summary text,
    #  prepend old summary to the summary head to avoid loss)
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
