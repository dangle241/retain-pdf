"""Chuẩn hóa định dạng cơ học cho bản dịch ở chế độ direct_typst.

Chế độ direct_typst cho phép model xuất thẳng `$...$` inline LaTeX (khi render sẽ do
mitex phân tích). Model làm tốt phần ngữ nghĩa (nhận diện công thức, dịch, sửa hư hỏng
do OCR) nhưng đôi khi vi phạm các quy tắc định dạng cơ học: `$...$` dính sát văn bản,
hai công thức liền nhau `$..$$..$`, lệnh hai dấu chéo ngược. Khi biên `$` đã tồn tại,
những quy tắc này là thao tác văn bản tất định, nên module này đảm bảo thống nhất ngay
lúc dịch (trước khi kiểm tra, trước khi đưa vào cache) thay vì trông chờ model tự giữ
kỷ luật qua prompt.

Ngữ nghĩa quét `$` được căn theo tokenizer của tầng render
(services/rendering/layout/text_tokens.py), để việc chuẩn hóa lúc dịch và passthrough lúc
render xác định biên của các đoạn giống nhau. Chuỗi chuẩn hóa sẵn có ở tầng render
(surround_inline_math_with_spaces v.v.) được giữ nguyên, làm phương án dự phòng lũy đẳng
cho các mục cache cũ.
Module này bắt buộc không phụ thuộc gì: translation và rendering đều có thể import
pipeline_shared, nhưng hai bên không được import lẫn nhau.
"""

from __future__ import annotations

import re

MAX_INLINE_MATH_CHARS = 1200

_LEFT_NO_SPACE = set("([{\"'“‘（【「『")
_RIGHT_NO_SPACE = set(".,;:!?)]}，。！？；：、（）【】「」『』")
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
    # Căn theo normalize_direct_typst_inline_math_whitespace ở tầng render: ký tự xuống dòng
    # bên trong inline math khiến bộ quét không nhận diện đoạn đó, phải gộp thành dấu cách
    # trước khi quét.
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
        # Định giới không cân bằng là hư hỏng cấu trúc: để math_delimiter_unbalanced kiểm tra
        # và LLM sửa trên văn bản gốc, không chuẩn hóa trên đầu vào khuyết.
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
        # Chỉ sửa những chỗ dính sát chắc chắn sai: đoạn công thức nằm sát văn bản CJK, hoặc
        # hai đoạn công thức dính liền nhau ($a$$b$). Cạnh ASCII thì không động — bản dịch
        # có thể chứa biến $ theo nghĩa đen (ví dụ $rem), bộ quét sẽ hiểu nhầm
        # `$rem ... $` là một đoạn, thêm dấu cách sẽ phá văn bản đó.
        prefix = " " if (_is_cjk_char(prev_char) and prev_char not in _LEFT_NO_SPACE) or start == prev_span_end else ""
        suffix = " " if _is_cjk_char(next_char) and next_char not in _RIGHT_NO_SPACE else ""
        chunks.append(f"{prefix}{expr}{suffix}")
        last_end = end
        prev_span_end = end
    chunks.append(source[last_end:])
    return _MULTI_SPACE_RE.sub(" ", "".join(chunks))


# Cơ sở dữ liệu các cách viết mitex không hỗ trợ: tương ứng với quy tắc viết lại của
# sanitize_direct_typst_inline_math ở tầng render
# (services/rendering/layout/inline_content/core/inline_math.py).
# Công dụng: quét văn bản gốc trước khi dịch, khớp mục nào thì nhắc mục đó cho model để
# model thay thế ở tầng ngữ nghĩa — viết lại bằng regex trong công thức phức tạp chắc
# chắn sai, nhưng "phát hiện một lệnh có xuất hiện" thì đáng tin cậy.
# Việc viết lại bằng regex lúc render vẫn giữ làm phương án dự phòng.
MITEX_REWRITE_DATABASE: tuple[tuple[str, str], ...] = (
    (r"\hbar", "ℏ"),
    (r"\partial", "∂"),
    (r"\otimes", "⊗"),
    (r"\mathscr", r"\mathcal"),
    (r"\varPhi", r"\Phi"),
    (r"\langle", "⟨"),
    (r"\rangle", "⟩"),
    (r"\circled", r"\otimes or a plain character"),
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
