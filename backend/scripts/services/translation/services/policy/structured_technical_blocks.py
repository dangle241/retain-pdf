from __future__ import annotations

import re

from services.translation.services.policy.hints import TranslationPolicyHint
from services.translation.services.policy.hints import apply_policy_hints


FIELD_LABEL_RE = re.compile(r"(?:^|\s*[•\-]\s+)([A-Za-z][A-Za-z0-9 _./-]{1,40})\s*:")
SHORT_LITERAL_VALUE_RE = re.compile(
    r"^(?:"
    r"-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?"
    r"|true|false|null|none|yes|no"
    r"|<[^<>\n]{1,80}>"
    r"|\"[^\"]{0,120}\""
    r"|'[^']{0,120}'"
    r"|\[[^\]\n]{1,160}\]"
    r")$",
    re.I,
)
MAX_STRUCTURED_BLOCK_CHARS = 1200
MIN_MULTI_FIELD_LABELS = 2


def _normalized_text(item: dict) -> str:
    return " ".join(str(item.get("source_text", "") or "").split()).strip()


def _field_labels(text: str) -> list[str]:
    labels: list[str] = []
    for match in FIELD_LABEL_RE.finditer(text):
        label = " ".join(match.group(1).split()).strip()
        if label:
            labels.append(label)
    return labels


def _single_field_value(text: str) -> str:
    if ":" not in text:
        return ""
    return text.split(":", 1)[1].strip()


def _is_short_literal_value(text: str) -> bool:
    return bool(SHORT_LITERAL_VALUE_RE.fullmatch(text.strip()))


def _is_structured_field_block(text: str) -> bool:
    labels = _field_labels(text)
    if len(labels) >= MIN_MULTI_FIELD_LABELS:
        return True
    if len(labels) != 1:
        return False
    # Một trường đơn chỉ mang tính cấu trúc khi giá trị của nó rõ ràng là literal.
    # Văn xuôi như "Note: This option controls..." phải giữ nguyên dạng văn bản thông thường.
    return _is_short_literal_value(_single_field_value(text))


def looks_like_structured_technical_block(item: dict) -> bool:
    text = _normalized_text(item)
    if not text or len(text) > MAX_STRUCTURED_BLOCK_CHARS:
        return False
    return _is_structured_field_block(text)


def structured_technical_style_hint(item: dict) -> str:
    if not looks_like_structured_technical_block(item):
        return ""
    labels = _field_labels(_normalized_text(item))
    label_text = "、".join(labels[:6])
    return (
        "Đây là mục cấu trúc trong tài liệu kỹ thuật"
        + (f"(trường bao gồm:{label_text}）" if label_text else "")
        + ". Vui lòng giữ ổn định tên trường, thứ tự trường, ký hiệu danh sách, dấu phân cách và xuống dòng;"
        "Giá trị trường, ký hiệu kiểu, liệt kê, đường dẫn, lệnh, tên biến, tên tệp, đoạn mã và nội dung trong dấu <> giữ nguyên;"
        "Chỉ dịch phần giá trị trường rõ ràng là thuyết minh ngôn ngữ tự nhiên. Không đổi tên trường cấu trúc sang ngôn ngữ khác."
    )


def collect_structured_technical_hints(payload: list[dict]) -> list[TranslationPolicyHint]:
    hints: list[TranslationPolicyHint] = []
    for item in payload:
        hint = structured_technical_style_hint(item)
        if not hint:
            continue
        item_id = str(item.get("item_id", "") or "")
        if not item_id:
            continue
        hints.append(
            TranslationPolicyHint(
                item_id=item_id,
                structure_kind="structured_technical_block",
                style_hint=hint,
            )
        )
    return hints


def apply_structured_technical_context(payload: list[dict]) -> int:
    """Compatibility wrapper; new policy flow should collect hints first."""

    return apply_policy_hints(payload, collect_structured_technical_hints(payload))


__all__ = [
    "apply_structured_technical_context",
    "collect_structured_technical_hints",
    "looks_like_structured_technical_block",
    "structured_technical_style_hint",
]
