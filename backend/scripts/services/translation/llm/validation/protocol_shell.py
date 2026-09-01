from __future__ import annotations

import re


MODEL_REQUEST_PROMPT_RE = re.compile(
    r"^(?:"
r"please\s*(?:Provide|Enter|Give|Paste|Send)\s*(?:Pending translation?)?\s*(?:source text|Text|Content|source)(?:[ã.!!??\s]*)|"
    r"(?:please\s+)?(?:provide|send|enter|paste)\s+(?:the\s+)?(?:source\s+)?(?:text|content)(?:\s+to\s+translate)?(?:[。.!!??\s]*)"
    r")$",
    re.I,
)
MODEL_REQUEST_PROMPT_MAX_CHARS = 48


def looks_like_protocol_shell_output(translated_text: str) -> bool:
    text = str(translated_text or "").strip()
    if not text:
        return False
    if len(text) <= MODEL_REQUEST_PROMPT_MAX_CHARS and MODEL_REQUEST_PROMPT_RE.fullmatch(text):
        return True
    if not text.startswith("{"):
        return False
    return (
        '"translated_text"' in text
        or '"translations"' in text
        or "“translated_text”" in text
        or "“translations”" in text
    )


__all__ = [
    "MODEL_REQUEST_PROMPT_MAX_CHARS",
    "MODEL_REQUEST_PROMPT_RE",
    "looks_like_protocol_shell_output",
]
