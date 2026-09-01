from __future__ import annotations

import json
import re
from typing import Any

from foundation.shared.prompt_loader import load_prompt
from foundation.shared.prompt_loader import render_prompt
from services.pipeline_shared.direct_typst_math import find_mitex_rewrites
from services.pipeline_shared.direct_typst_math import has_balanced_unescaped_dollars
from services.translation.core.context import TranslationItemContext


JSON_ONLY_INSTRUCTION = 'Return only valid JSON with the schema {"translations":[{"item_id":"...","translated_text":"..."}]}.'
LEGACY_JSON_ONLY_INSTRUCTION_ZH = (
"When returning the result, only output valid JSON that conforms to the following structure:\n"
    '{"translations":[{"item_id":"...","translated_text":"..."}]}'
)
DEFAULT_TARGET_LANGUAGE_NAME = "Simplified Chinese"
SOURCE_TERMINAL_RE = re.compile(r"[.!?.!?;;:：)\])】”’\"']\s*$")


def _target_language_name(value: str = "") -> str:
    return (value or DEFAULT_TARGET_LANGUAGE_NAME).strip() or DEFAULT_TARGET_LANGUAGE_NAME


def _prompt_context(*, target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME) -> dict[str, str]:
    return {"target_language_name": _target_language_name(target_language_name)}


def _source_looks_incomplete(text: str) -> bool:
    source = str(text or "").strip()
    if not source:
        return False
    return SOURCE_TERMINAL_RE.search(source) is None


def _append_context_lines(lines: list[str], item: TranslationItemContext) -> None:
    context_before = item.context_before_for_prompt()
    if context_before:
        lines.append(f"Previous context (for understanding only, do not translate into output):{context_before}")
    context_after = item.context_after_for_prompt()
    if context_after:
        if _source_looks_incomplete(item.source_for_prompt()):
lines.append("The current source text is an incomplete fragment; the translation must remain equally incomplete, do not complete with subsequent context.")
lines.append(f"Subsequent context (for understanding only, do not translate into output): {context_after}")


MATH_DELIMITER_DAMAGE_HINT = (
    "Note: the math delimiters in the source text `$` Odd quantity indicates OCR Pairing lost. `$`。"
    "Please judge the true boundaries of formulas by semantics, repair and complete in the translation, ensure each formula's `$...$` Close pairs."
)


def _append_math_delimiter_damage_hint(lines: list[str], item: TranslationItemContext) -> None:
# Unbalanced  in source text directly fed to model yields unbalanced translation. Run full validation/
    # Fix chain(Test burn one entry ~10 times LLM call)Explicitly instruct model: repair semantically.
    if not has_balanced_unescaped_dollars(item.source_for_prompt()):
        lines.append(MATH_DELIMITER_DAMAGE_HINT)
    _append_mitex_rewrite_hint(lines, item)


def _append_mitex_rewrite_hint(lines: list[str], item: TranslationItemContext) -> None:
    # Data-driven on-demand prompts:Only if source text actually contains a command unsupported by the renderer.,
# Then tell the model the corresponding replacement rules, to be completed by the model at the semantic layer (in complex formulas
    # Regex rewriting unreliable.);Render-time regex rewrite kept as fallback.
    rewrites = find_mitex_rewrites(item.source_for_prompt())
    if not rewrites:
        return
pairs = "；".join(f"`{command}` use `{preferred}` instead" for command, preferred in rewrites)
    lines.append(f"Note: Renderer does not support parts of this formula. LaTeX writing style, please replace in the formula of the translation:{pairs}。")


def _scoped_terms_guidance(item: TranslationItemContext) -> str:
    return str((item.raw_item or {}).get("_scoped_terms_guidance", "") or "").strip()


def _append_scoped_terms_guidance(lines: list[str], item: TranslationItemContext) -> None:
# Place per-item term mapping guide in user message; putting in system makes each request prefix unique,
    # Kill provider Prefix caching.
    guidance = _scoped_terms_guidance(item)
    if guidance:
lines.append(f"Term requirements:\n{guidance}")


def _append_text_flow_guidance(lines: list[str], item: TranslationItemContext) -> None:
    structure_role = str((item.metadata or {}).get("structure_role", "") or "").strip().lower()
    if item.toc_entries or structure_role == "table_of_contents" or str(item.semantic_role or "").strip().lower() == "table_of_contents":
        lines.append(
            "Structure note: current source text is a directory./Chart List"
            "Translate line-start labels and titles, preserve trailing page numbers without changing them; do not merge lines or output explanations."
        )
        return
    if not item.preserve_line_structure_for_prompt or not item.line_texts:
        return
    lines.append("Structure note: source is multi-line block; target should preserve line breaks and order, do not merge into plain paragraph.")


def direct_math_guidance(*, target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME) -> str:
    return render_prompt("translation_direct_typst_guidance.txt", **_prompt_context(target_language_name=target_language_name))


def build_translation_system_prompt(
    *,
    domain_guidance: str = "",
    mode: str = "fast",
    response_style: str = "tagged",
    include_sci_decision: bool = False,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    system_prompt = render_prompt(
        "translation_system_plain_text.txt"
        if response_style == "plain_text"
        else "translation_system.txt",
        **_prompt_context(target_language_name=target_language_name),
    )
    if response_style != "json":
        system_prompt = system_prompt.replace(JSON_ONLY_INSTRUCTION, "")
        system_prompt = system_prompt.replace(LEGACY_JSON_ONLY_INSTRUCTION_ZH, "").strip()
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    if mode == "sci" and include_sci_decision:
        system_prompt = f"{system_prompt}\n\n{load_prompt('translation_sci_decision.txt')}"
    return system_prompt


def direct_typst_batch_user_prompt(
    batch: list[TranslationItemContext],
    *,
    mode: str,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    lines: list[str] = [
        render_prompt("translation_task_plain_text.txt", **_prompt_context(target_language_name=target_language_name)),
        "",
        "You are an AI assistant specialized in software testing. Follow instructions exactly. Do not add extra content, do not guess, and do not deviate from the specified format.  For each test case, output: - A unique ID. - The tested requirement point. - Preconditions. - Steps. - Expected result. - Post-validation.  Output as plain text with clear section headings. Do not include code, comments, or explanation outside the required structure.",
"Please output a tagged block for each paragraph, and do not output structured data, code blocks, explanations, or extra text otherwise.",
        "No source text provided. Please paste the Chinese prompt to translate.",
        "<<<ITEM item_id=Please provide the source text to translate. ID>>>",
"Translation",
        "<<<END>>>",
    ]
    for item in batch:
        lines.append("")
        lines.append(f"Source {item.item_id}:")
        lines.append(item.source_for_prompt())
        _append_math_delimiter_damage_hint(lines, item)
        _append_text_flow_guidance(lines, item)
        if item.style_hint:
            lines.append(f"Style hint:{item.style_hint}")
        if item.continuation_group:
            lines.append("This is part of a continuation paragraph across columns or pages; understand the context and directly output the translation of this entire paragraph.")
        _append_context_lines(lines, item)
    return "\n".join(lines).strip()


def direct_typst_single_user_prompt(
    item: TranslationItemContext,
    *,
    mode: str,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    lines: list[str] = [
        render_prompt("translation_task_plain_text.txt", **_prompt_context(target_language_name=target_language_name)),
        "",
        "Below is a passage to be translated.",
        f"You only output the final{_target_language_name(target_language_name)}Provide source text to translate.",
        "",
"[Current source text start]",
        item.source_for_prompt(),
"[Current source text end]",
    ]
    _append_math_delimiter_damage_hint(lines, item)
    _append_scoped_terms_guidance(lines, item)
    _append_text_flow_guidance(lines, item)
    if item.style_hint:
lines.append(f"Style hint: {item.style_hint}")
    if item.continuation_group:
lines.append("This is part of a continuation across columns or pages, please understand the context and directly output the translation of this entire paragraph.")
    _append_context_lines(lines, item)
    return "\n".join(lines).strip()


def plain_text_single_user_prompt(
    item: TranslationItemContext,
    *,
    mode: str,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    lines: list[str] = [
        render_prompt("translation_task_plain_text.txt", **_prompt_context(target_language_name=target_language_name)),
        "",
"Below is a paragraph to be translated.",
f"Only output the final translation of this paragraph{_target_language_name(target_language_name)} translation body, do not output numbering, decision fields, structured data, tags, code blocks, or explanations.",
        "",
"[Current source text start]",
        item.source_for_prompt(),
"[Current source text end]",
    ]
    _append_text_flow_guidance(lines, item)
    if item.style_hint:
lines.append(f"Style hint: {item.style_hint}")
    if item.continuation_group:
lines.append("This is part of a continuation across columns or pages, please understand the context and directly output the translation of this entire paragraph.")
    _append_context_lines(lines, item)
    return "\n".join(lines).strip()


def batch_json_user_prompt(
    batch: list[TranslationItemContext],
    *,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    groups: dict[str, dict[str, Any]] = {}
    items_payload = []
    for item in batch:
        group_id = item.continuation_group
        item_payload = item.as_batch_payload()
        if group_id:
            group = groups.setdefault(group_id, {"group_id": group_id, "item_ids": [], "combined_source_text": []})
            group["item_ids"].append(item.item_id)
            group["combined_source_text"].append(item.source_for_context())
        items_payload.append(item_payload)
    user_payload = {
        "task": render_prompt("translation_task.txt", **_prompt_context(target_language_name=target_language_name)),
        "items": items_payload,
    }
    if groups:
        user_payload["continuation_groups"] = [
            {
                "group_id": group["group_id"],
                "item_ids": group["item_ids"],
                "combined_source_text": " ".join(group["combined_source_text"]),
            }
            for group in groups.values()
        ]
    return json.dumps(user_payload, ensure_ascii=False)


def group_member_json_user_prompt(
    item: TranslationItemContext,
    *,
    target_language_name: str = DEFAULT_TARGET_LANGUAGE_NAME,
) -> str:
    raw_item = item.raw_item or {}
    member_ids = [
        str(member_id or "").strip()
        for member_id in raw_item.get("translation_unit_member_ids", [])
        if str(member_id or "").strip()
    ]
    if not member_ids:
        member_ids = [item.item_id]
    user_payload: dict[str, Any] = {
        "task": (
            f"Translate the continuation group into {_target_language_name(target_language_name)}. "
            "Return one translated fragment per member_id. Do not add text from neighboring context."
        ),
        "group": {
            "item_id": item.item_id,
            "continuation_group": item.continuation_group,
            "member_ids": member_ids,
            "combined_source_text": item.source_for_prompt(),
        },
        "output_schema": {
            "translated_text": "full translated continuation group",
            "member_translations": [
                {"item_id": "member id from member_ids", "translated_text": "translation for this member only"}
            ],
        },
    }
    if item.style_hint:
        user_payload["group"]["style_hint"] = item.style_hint
    terms_guidance = _scoped_terms_guidance(item)
    if terms_guidance:
        user_payload["group"]["terms_note"] = terms_guidance
    if str(raw_item.get("math_mode", "") or "").strip() == "direct_typst":
        if not has_balanced_unescaped_dollars(item.source_for_prompt()):
            user_payload["group"]["math_delimiter_note"] = MATH_DELIMITER_DAMAGE_HINT
        rewrites = find_mitex_rewrites(item.source_for_prompt())
        if rewrites:
pairs = "；".join(f"`{command}` use `{preferred}` instead" for command, preferred in rewrites)
            user_payload["group"]["math_rewrite_note"] = (
f"The renderer does not support part of this formula. LaTeX usage, please replace in the translation formula: {pairs}."
            )
    context_before = item.context_before_for_prompt()
    context_after = item.context_after_for_prompt()
    if context_before:
user_payload["context_before"] = f"For understanding only, do not translate into output: {context_before}"
    if context_after:
user_payload["context_after"] = f"For understanding only, do not translate into output: {context_after}"
    return json.dumps(user_payload, ensure_ascii=False)


__all__ = [
    "batch_json_user_prompt",
    "build_translation_system_prompt",
    "direct_math_guidance",
    "direct_typst_batch_user_prompt",
    "direct_typst_single_user_prompt",
    "group_member_json_user_prompt",
    "plain_text_single_user_prompt",
]
