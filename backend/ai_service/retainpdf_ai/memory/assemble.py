"""Feed transcript into Harvest agent's history messages."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .compress import is_summary_message, split_transcript


def estimate_tokens(text: str) -> int:
    """Cheap mixed CN/EN estimation: approx chars/2.5。"""
    n = len(text or "")
    return max(1, int(n / 2.5)) if n else 0


def _clip_content(role: str, content: str, *, user_max: int = 2000, assistant_max: int = 3000) -> str:
    text = str(content or "")
    limit = user_max if role == "user" else assistant_max
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}…"


@dataclass
class AssembleResult:
    history: list[dict[str, str]]
    debug: dict[str, Any] = field(default_factory=dict)


def assemble_history(
    messages: list[dict[str, Any]],
    *,
    window_turns: int = 6,
    max_chars: int = 24000,
) -> AssembleResult:
    """
    complete input/already compressed transcript, output agent.ask(history=...) Use user/assistant List.

    - If present summaryinjection「Summary Background」pseudo-round
    - Window:summary After window_turns rounds
    - Single item too long clipOverall exceeded. max_chars Continue dropping from window header.
    """
    window_turns = max(1, int(window_turns))
    last_summary, turns = split_transcript(messages)

    keep_n = window_turns * 2
    window = turns[-keep_n:] if len(turns) > keep_n else list(turns)

    history: list[dict[str, str]] = []
    if last_summary and str(last_summary.get("content") or "").strip():
        summary_body = str(last_summary.get("content") or "").strip()
        history.append(
            {
                "role": "user",
                "content": f"The following is a summary of earlier conversation; treat as known background:\n{summary_body}",
            }
        )
        history.append(
            {
                "role": "assistant",
                "content": "Okay, I will continue based on the summary and new questions.",
            }
        )

    for message in window:
        role = str(message.get("role") or "")
        if role not in {"user", "assistant"}:
            continue
        if is_summary_message(message):
            continue
        content = _clip_content(role, str(message.get("content") or ""))
        if not content.strip():
            continue
        history.append({"role": role, "content": content})

    # Drop total guardrail length: start from window header (after summary pseudo-round).
    def total_chars(items: list[dict[str, str]]) -> int:
        return sum(len(m.get("content") or "") for m in items)

    prefix_len = 2 if last_summary else 0
    while len(history) > prefix_len + 2 and total_chars(history) > max_chars:
        # Discard earliest pair turnPaired where possible.
        del history[prefix_len]
        if len(history) > prefix_len and history[prefix_len]["role"] == "assistant":
            del history[prefix_len]

    prompt_est = estimate_tokens("\n".join(m["content"] for m in history))
    return AssembleResult(
        history=history,
        debug={
            "window_turns": window_turns,
            "had_summary": bool(last_summary),
            "history_messages": len(history),
            "prompt_tokens_est": prompt_est,
            "total_chars": total_chars(history),
        },
    )
