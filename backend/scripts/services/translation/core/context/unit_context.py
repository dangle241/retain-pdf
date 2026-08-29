from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.translation.core.context.models import TranslationDocumentContext
from services.translation.core.context.models import TranslationItemContext
from services.translation.core.context.models import build_item_context
from services.translation.core.context.models import sanitize_prompt_context_text


@dataclass(frozen=True)
class TranslationUnitContext:
    """Gói ngữ cảnh ổn định cho một đơn vị dịch.

    Đối tượng này chỉ chứa dữ liệu. Quy trình có thể xây dựng nó,
    nhà cung cấp có thể đọc từ nó, nhưng không nên thay đổi trường dữ liệu
    thông qua đối tượng này.
    """

    document: TranslationDocumentContext
    item: TranslationItemContext
    context_before: str = ""
    context_after: str = ""
    memory_guidance: str = ""
    glossary_guidance: str = ""

    def prompt_context_before(self) -> str:
        return sanitize_prompt_context_text(self.context_before or self.item.context_before)

    def prompt_context_after(self) -> str:
        return sanitize_prompt_context_text(self.context_after or self.item.context_after)

    def prompt_guidance_parts(self) -> list[str]:
        parts = [
            self.document.domain_guidance,
            self.document.rule_guidance,
            self.document.glossary_guidance,
            self.memory_guidance,
            self.glossary_guidance,
        ]
        return [part.strip() for part in parts if part and part.strip()]


def build_unit_context(
    item: dict[str, Any],
    *,
    document_context: TranslationDocumentContext | None = None,
    order: int = 0,
    page_idx: int | None = None,
    memory_guidance: str = "",
    glossary_guidance: str = "",
) -> TranslationUnitContext:
    item_context = build_item_context(item, order=order, page_idx=page_idx)
    return TranslationUnitContext(
        document=document_context or TranslationDocumentContext(),
        item=item_context,
        context_before=item_context.context_before,
        context_after=item_context.context_after,
        memory_guidance=memory_guidance,
        glossary_guidance=glossary_guidance,
    )


def build_unit_contexts(
    payload: list[dict[str, Any]],
    *,
    document_context: TranslationDocumentContext | None = None,
    page_idx: int | None = None,
    memory_guidance: str = "",
    glossary_guidance: str = "",
) -> list[TranslationUnitContext]:
    return [
        build_unit_context(
            item,
            document_context=document_context,
            order=order,
            page_idx=page_idx,
            memory_guidance=memory_guidance,
            glossary_guidance=glossary_guidance,
        )
        for order, item in enumerate(payload, start=1)
    ]


__all__ = ["TranslationUnitContext", "build_unit_context", "build_unit_contexts"]
