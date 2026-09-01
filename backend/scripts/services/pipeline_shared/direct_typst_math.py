"""direct_typst Mechanical formatting of the direct_typst translation.

direct_typst mode lets the model output directly $...$ inline LaTeX (parsed by mitex).
Model reliably completes semantic tasks.(recognize formulas, translate, repair OCR Damage),but occasionally violates mechanical formatting
Rule: $...$ a = b + c d = a * 2 print(d) $..$$..$ \ escape in Windows paths. Use raw strings. r"C:\path\to\file" $
Given boundaries: deterministic text ops.,This module ensures uniformity during translation.(Cache before validation.
before),Rather than using prompts to demand self-discipline from the model.

`$` Scan Semantic Alignment Render Layer tokenizer(services/rendering/layout/text_tokens.py),
Normalize during translation and rendering. passthrough Consistent span boundary determination. Existing regularization chain in rendering layer.
(surround_inline_math_with_spaces etc.) Keep unchanged, idempotent fallback for stale cache entries.
This module must remain zero-dependency: translation and rendering either works, import pipeline_shared,
but the two cannot mutually import。
"""

from __future__ import annotations

import re

MAX_INLINE_MATH_CHARS = 1200

_LEFT_NO_SPACE = set("([{\"'(【「『")
_RIGHT_NO_SPACE = set(".,;:!?)]}()【】「」『』")
_DOUBLE_BACKSLASH_COMMAND_RE = re.compile(r"\\{2,}(?=[A-Za-z])")
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def _is_cjk_char(char: str) -> bool:
    if not char:
        return False
    code = ord(char)
    return 0x3400 <= code <= 0x4DBF or 0x4E00 <= code <= 0x9FFF or 0x3000 <= code <= 0x303F or 0xFF00 <= code <= 0xFFEF


def _is_escaped(text: str, index: int) -> bool:
    backslashes = 0
    cursor = index - 1
    while cursor >= 0 and text[cursor] == "\\":
        backslashes += 1
        cursor -= 1
    return backslashes % 2 == 1


def has_balanced_unescaped_dollars(text: str) -> bool:
    source = text or ""
    count = sum(
        1
        for index, char in enumerate(source)
        if char == "$" and not _is_escaped(source, index)
    )
    return count % 2 == 0


def _match_display_math(text: str, index: int) -> int:
    if not text.startswith("$$", index) or _is_escaped(text, index):
        return index
    cursor = index + 2
    while cursor + 1 < len(text):
        if text[cursor] == "\\":
            cursor += 2
            continue
        if text.startswith("$$", cursor):
            return cursor + 2
        cursor += 1
    return index


def _match_inline_math(text: str, index: int) -> int:
    if (
        text[index] != "$"
        or text.startswith("$$", index)
        or _is_escaped(text, index)
        or index + 1 >= len(text)
    ):
        return index
    cursor = index + 1
    while cursor < len(text):
        if cursor - index > MAX_INLINE_MATH_CHARS:
            return index
        char = text[cursor]
        if char == "\n":
            return index
        if char == "\\":
            cursor += 2
            continue
        if char == "$":
            body = text[index + 1 : cursor].strip()
            return cursor + 1 if body else index
        cursor += 1
    return index


def _scan_math_spans(text: str) -> list[tuple[int, int, bool]]:
    spans: list[tuple[int, int, bool]] = []
    index = 0
    while index < len(text):
        if text[index] == "$":
            end = _match_display_math(text, index)
            if end > index:
                spans.append((index, end, True))
                index = end
                continue
            end = _match_inline_math(text, index)
            if end > index:
                spans.append((index, end, False))
                index = end
                continue
        index += 1
    return spans


def _collapse_newlines_inside_inline_math(text: str) -> str:
    # Align rendering layer. normalize_direct_typst_inline_math_whitespace:inline Math
    # Internal newlines cause scanner to reject span.,Collapse to spaces before scanning.
    chunks: list[str] = []
    index = 0
    in_inline_math = False
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""
        if char == "$" and not _is_escaped(text, index):
            if next_char == "$":
                chunks.append("$$")
                index += 2
                continue
            in_inline_math = not in_inline_math
            chunks.append(char)
            index += 1
            continue
        if in_inline_math and char in "\r\n":
            if not chunks or chunks[-1] != " ":
                chunks.append(" ")
            index += 1
            while index < len(text) and text[index] in "\r\n\t ":
                index += 1
            continue
        chunks.append(char)
        index += 1
    return "".join(chunks)


def _normalize_math_body(value: str, *, display: bool) -> str:
    marker = "$$" if display else "$"
    body = value[len(marker) : len(value) - len(marker)]
    body = _DOUBLE_BACKSLASH_COMMAND_RE.sub(r"\\", body)
    return f"{marker}{body}{marker}"


def normalize_direct_typst_translation(text: str) -> str:
    source = str(text or "")
    if not source or "$" not in source:
        return source
    if not has_balanced_unescaped_dollars(source):
        # Unbalanced delimiters indicate structural corruption.,Hand over math_delimiter_unbalanced validation and
        # LLM Fix raw text handling.,No normalization on incomplete input.
        return source
    source = _collapse_newlines_inside_inline_math(source)
    spans = _scan_math_spans(source)
    if not spans:
        return source
    chunks: list[str] = []
    last_end = 0
    prev_span_end = -1
    for start, end, display in spans:
        chunks.append(source[last_end:start])
        expr = _normalize_math_body(source[start:end], display=display)
        prev_char = source[start - 1] if start > 0 else ""
        next_char = source[end] if end < len(source) else ""
        # Fix only confirmed violations. Tighten.:span adjacent to Chinese text,Or two formula spans directly adjacent.
        # ($a$$b$)。ASCII Adjacent immovable——Literal text may appear in translation $ 变量(如 $rem),
        # Scanner will `$rem ... $` misidentified as a span,Padding spaces corrupts literal text.
        prefix = " " if (_is_cjk_char(prev_char) and prev_char not in _LEFT_NO_SPACE) or start == prev_span_end else ""
        suffix = " " if _is_cjk_char(next_char) and next_char not in _RIGHT_NO_SPACE else ""
        chunks.append(f"{prefix}{expr}{suffix}")
        last_end = end
        prev_span_end = end
    chunks.append(source[last_end:])
    return _MULTI_SPACE_RE.sub(" ", "".join(chunks))


# mitex incompatible DB syntax: with rendering layer sanitize_direct_typst_inline_math's
# Rewrite rule mapping(services/rendering/layout/inline_content/core/inline_math.py)。
# Purpose: scan source text before translation, pass matched prompt to model, by model at semantic layer
# Replacement complete.——Regex rewrite in complex formulas inevitably fails,but"Detect command occurrence."Reliable.
# Retain render-phase regex rewrite as fallback.
MITEX_REWRITE_DATABASE: tuple[tuple[str, str], ...] = (
    (r"\hbar", "ℏ"),
    (r"\partial", "∂"),
    (r"\otimes", "⊗"),
    (r"\mathscr", r"\mathcal"),
    (r"\varPhi", r"\Phi"),
    (r"\langle", "⟨"),
    (r"\rangle", "⟩"),
    (r"\circled", r"\otimes or ordinary characters"),
)


def find_mitex_rewrites(text: str) -> list[tuple[str, str]]:
    source = str(text or "")
    if "\\" not in source:
        return []
    matched: list[tuple[str, str]] = []
    for command, preferred in MITEX_REWRITE_DATABASE:
        if re.search(re.escape(command) + r"(?![A-Za-z])", source):
            matched.append((command, preferred))
    return matched


__all__ = [
    "MITEX_REWRITE_DATABASE",
    "find_mitex_rewrites",
    "has_balanced_unescaped_dollars",
    "normalize_direct_typst_translation",
]
