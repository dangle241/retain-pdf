from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


def test_translate_single_item_plain_text_uses_plain_text_protocol() -> None:
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "The advancement of complex computer programs.",
        "translation_unit_protected_source_text": "The advancement of complex computer programs.",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    captured: dict[str, object] = {}

    def _fake_messages(*args, **kwargs):
        captured["response_style"] = kwargs.get("response_style")
        return [{"role": "system", "content": "stub"}]

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["response_format"] = kwargs.get("response_format")
        return "Complex computer program development."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
assert result["p001-b001"]["translated_text"] == "The development of complex computer programs."


def test_translate_batch_once_uses_tagged_protocol_without_schema() -> None:
    batch = [
        {
            "item_id": "p001-b001",
            "protected_source_text": "The advancement of complex computer programs.",
            "translation_unit_protected_source_text": "The advancement of complex computer programs.",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        },
        {
            "item_id": "p001-b002",
            "protected_source_text": "Faster computing power improves simulation.",
            "translation_unit_protected_source_text": "Faster computing power improves simulation.",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        },
    ]
    captured: dict[str, object] = {}

    def _fake_messages(*args, **kwargs):
        captured["response_style"] = kwargs.get("response_style")
        return [{"role": "system", "content": "stub"}]

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["response_format"] = kwargs.get("response_format")
        return (
"<<<ITEM item_id=p001-b001>>>\nThe development of complex computer programs.\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\nFaster compute improves simulation capability.\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
assert result["p001-b001"]["translated_text"] == "The development of complex computer programs."
assert result["p001-b002"]["translated_text"] == "Faster compute improves simulation capability."


def test_translate_continuation_group_members_repairs_loose_json_response() -> None:
    item = {
        "item_id": "__cg__:cg-010-001",
        "translation_unit_id": "__cg__:cg-010-001",
        "translation_unit_member_ids": ["p010-b001", "p010-b002"],
        "protected_source_text": "This sentence starts and continues.",
        "translation_unit_protected_source_text": "This sentence starts and continues.",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }

    def _fake_request(_messages, **_kwargs):
        return """
        {
          translated_text: "This sentence starts and continues.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "This sentence starts"},
            {"item_id": "p010-b002", "translated_text": "and continues."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
assert payload["translated_text"] == "This sentence starts and continues."
assert payload["member_translations"][1]["translated_text"] == "and continues."


def test_build_messages_sci_tagged_uses_translation_only_protocol() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p001-b001",
                "protected_source_text": "Experimentally test the mechanism.",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    assert "<<<ITEM item_id=ITEM_ID>>>" in messages[0]["content"]
    assert "decision=translate" not in messages[0]["content"]


def test_build_messages_sanitizes_continuation_context_placeholders() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p006-b056",
                "protected_source_text": "The combination of these results",
                "continuation_group": "cg-001",
                "continuation_next_text": "evidence against a <f1-2e5/> catalytic cycle and <f2-9ad/> reaction pathway",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    payload = json.loads(messages[1]["content"])
    item_payload = payload["items"][0]
    assert (
        item_payload["context_after"]
        == "No source text provided. Please paste the Chinese text to translate.evidence against a catalytic cycle and reaction pathway"
    )
    assert "<f1-2e5/>" not in messages[1]["content"]
    assert "<f2-9ad/>" not in messages[1]["content"]


def test_build_single_item_fallback_messages_sanitizes_continuation_context_placeholders() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p006-b056",
            "protected_source_text": "The combination of these results",
            "continuation_next_text": "evidence against a <f1-2e5/> catalytic cycle and <f2-9ad/> reaction pathway",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "The current source is an incomplete fragment; the translation must remain equally incomplete; do not complete it using following context." in messages[1]["content"]
    assert "No source text provided. Please supply the Chinese text to translate.evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
    assert "<f1-2e5/>" not in messages[1]["content"]
    assert "<f2-9ad/>" not in messages[1]["content"]


def test_build_single_item_fallback_messages_plain_text_has_no_json_contract_conflict() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p014-b004",
            "protected_source_text": "Example 4.2 Example Q-CHEM input for a single point energy calculation on water.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    system_prompt = messages[0]["content"]

    assert "Source text missing. Please provide." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks, or explanations" in system_prompt
    assert "Only return valid results conforming to the following structure. JSON" not in system_prompt
    assert '{"translations":[{"item_id":"...","translated_text":"..."}]}' not in system_prompt
    assert "source_text" not in system_prompt
    assert "translated_text" not in system_prompt
    assert "item_id" not in system_prompt
    assert "decision" not in system_prompt
    assert "JSON" not in system_prompt


def test_build_single_item_fallback_messages_plain_text_user_prompt_is_not_json() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p026-b007",
            "protected_source_text": "As for any numerical optimization procedure, Q-CHEM features SCF algorithms.",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )

    assert "【[Source text starts]】" in messages[1]["content"]
    assert "【[Source text ends]】" in messages[1]["content"]
    assert "As for any numerical optimization procedure" in messages[1]["content"]
    assert "source_text" not in messages[1]["content"]
    assert "item_id" not in messages[1]["content"]
    assert "decision" not in messages[1]["content"]
    assert "JSON" not in messages[1]["content"]
    assert '"item_id"' not in messages[1]["content"]
    assert '"source_text"' not in messages[1]["content"]


def test_group_member_json_user_prompt_includes_member_ids_and_schema() -> None:
    item_context = build_item_context(
        {
            "item_id": "__cg__:cg-010-001",
            "translation_unit_member_ids": ["p010-b001", "p010-b002"],
            "continuation_group": "cg-010-001",
            "translation_unit_protected_source_text": "This sentence starts and continues.",
            "protected_source_text": "This sentence starts and continues.",
            "translation_context_after": "Do not include this context in output.",
            "metadata": {"structure_role": "body"},
        }
    )

    payload = json.loads(group_member_json_user_prompt(item_context))

    assert payload["group"]["item_id"] == "__cg__:cg-010-001"
    assert payload["group"]["member_ids"] == ["p010-b001", "p010-b002"]
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
    assert "Do not include this context" in payload["context_after"]


def test_plain_text_prompt_keeps_literal_preservation_in_translation_scope() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p006-b012",
            "protected_source_text": "$ uv pip install ./deepx-1.0.6+light-py3-none-any.whl[gpu]",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    combined_prompt = "\n".join(message["content"] for message in messages)

    assert "Do not rely solely. OCR" not in combined_prompt
    assert "standalone code, commands, configurations, input files, directory trees, or file manifests." not in combined_prompt
    assert "Please return as-is" not in combined_prompt
    assert "Preserve literals verbatim." in combined_prompt


def test_sci_tagged_prompt_does_not_make_translation_model_choose_keep_origin() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p006-b012",
                "protected_source_text": "$ uv pip install ./deepx-1.0.6+light-py3-none-any.whl[gpu]",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )

assert "standalone code, commands, configuration, input files, directory trees, or file listings" not in messages[0]["content"]
    assert "keep_origin" not in messages[0]["content"]


def test_build_messages_direct_typst_includes_inline_math_and_local_ocr_repair_guidance() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p001-b001",
                "protected_source_text": r"^{a} reaction at {10\mu}mol scale",
                "math_mode": "direct_typst",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    system_prompt = messages[0]["content"]
    user_prompt = messages[1]["content"]
    assert "Currently enabled direct_typst direct formula output mode" in system_prompt
    assert "First understand the whole sentence semantics" in system_prompt
    assert "Please proactively use. `$...$` Package" in system_prompt
    assert "use a single backslash" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # Spacing, close-fitting, double backslash, and other mechanical formatting rules by normalize_direct_typst_translation
    # Source text missing. Provide text to translate.,Stop consuming prompt tokens.
    assert "Space-separated" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode Superscript" in system_prompt
    assert "$^{117}$" in system_prompt
    assert "$^{26-28}$" in system_prompt
    assert "Minimum fix." in system_prompt
    assert "Do not fill in missing body content" in system_prompt
    assert "<<<ITEM item_id=ITEM_ID>>>" in system_prompt
    assert "Please provide the source text to translate. tagged block" in user_prompt
    assert "Do not write back IDs, decision fields, structured data, or tags." not in user_prompt
    assert r"\mu" in messages[1]["content"]
    assert r"\\mu" not in messages[1]["content"]


def test_build_single_item_fallback_messages_direct_typst_includes_inline_math_and_local_ocr_repair_guidance() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"^{a} reaction at {10\mu}mol scale",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    system_prompt = messages[0]["content"]
assert "direct_typst formula direct-output mode is currently enabled" in system_prompt
assert "First understand the semantics of the whole sentence" in system_prompt
assert "Proactively wrap with `$...$`" in system_prompt
assert "Use a single backslash" in system_prompt
    assert r"\mathrm{M}" in system_prompt
# Mechanical format rules such as spacing, tight placement, and double backslashes are handled by normalize_direct_typst_translation
# Normalized uniformly during translation; no longer occupy prompt tokens.
assert "separated by spaces" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
assert "Unicode superscript characters" in system_prompt
    assert "$^{117}$" in system_prompt
    assert "$^{26-28}$" in system_prompt
assert "minimal fix" in system_prompt
assert "Do not fill in missing body content" in system_prompt
    assert r"\mu" in messages[1]["content"]
    assert r"\\mu" not in messages[1]["content"]


def test_build_messages_direct_typst_keeps_single_backslash_source_text_in_user_prompt() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p010-b002",
                "protected_source_text": r"strengthens the argument that a \mathrm{Ni(I) / Ni(III)} cycle is operative.",
                "math_mode": "direct_typst",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    assert r"\mathrm{Ni(I) / Ni(III)}" in messages[1]["content"]
    assert r"\\mathrm{Ni(I) / Ni(III)}" not in messages[1]["content"]


def test_build_single_item_fallback_messages_direct_typst_keeps_single_backslash_source_text_in_user_prompt() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p010-b002",
            "protected_source_text": r"strengthens the argument that a \mathrm{Ni(I) / Ni(III)} cycle is operative.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert r"\mathrm{Ni(I) / Ni(III)}" in messages[1]["content"]
    assert r"\\mathrm{Ni(I) / Ni(III)}" not in messages[1]["content"]


def test_body_direct_typst_prompt_does_not_preserve_ocr_visual_lines() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p005-b025",
            "source_text": "For large $ CN_{A}^{\\prime} $ values, this d-level is lowered.",
            "protected_source_text": "For large $ CN_{A}^{\\prime} $ values, this d-level is lowered.",
            "source_line_texts": [
                "For large $ CN_{A}^{\\prime}",
                "$ values, this d-level is lowered.",
            ],
            "text_flow": "preserve_lines",
            "math_mode": "direct_typst",
            "semantic_role": "body",
            "structure_role": "body",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )

    assert "Structure hint: the current source is a multi-line structural block" not in messages[1]["content"]
    assert "For large $ CN_{A}^{\\prime} $ values, this d-level is lowered." in messages[1]["content"]
    assert "For large $ CN_{A}^{\\prime}\n$ values" not in messages[1]["content"]


def test_toc_prompt_asks_model_to_translate_each_list_line() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p008-b001",
            "source_text": "FIGURE 11.7 Long figure title 370\nTABLE 8.4 Long table title 279",
            "protected_source_text": "FIGURE 11.7 Long figure title 370\nTABLE 8.4 Long table title 279",
            "source_line_texts": [
                "FIGURE 11.7 Long figure title 370",
                "TABLE 8.4 Long table title 279",
            ],
            "text_flow": "preserve_lines",
            "math_mode": "direct_typst",
            "semantic_role": "table_of_contents",
            "structure_role": "table_of_contents",
            "metadata": {"structure_role": "table_of_contents"},
        },
        mode="sci",
        response_style="plain_text",
    )

    prompt = messages[1]["content"]

    assert "Contents/Chart List" in prompt
    assert "output one translation line per source line" in prompt
    assert "Translate line-start labels and titles" in prompt
    assert "Keep trailing page numbers" in prompt


def test_prompt_builder_can_render_non_default_target_language() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "Keep terminology accurate.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
        target_language_name="Ready. Provide source text.",
    )
    combined_prompt = "\n".join(message["content"] for message in messages)

    assert "English suitable for thesis typesetting." in combined_prompt
    assert "Please provide the Chinese source text to translate." in combined_prompt
    assert "Source text missing. Please provide original Chinese text for translation." in combined_prompt
    assert "Provide source text to translate." not in combined_prompt


def test_parse_translation_payload_accepts_well_formed_tagged_blocks() -> None:
    content = (
        "<<<ITEM item_id=a>>>\nTranslationA\n<<<END>>>\n"
        "<<<ITEM item_id=b decision=keep_origin>>>\n\n<<<END>>>\n"
    )
    result = translation_client.parse_translation_payload(content)
assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["decision"] == "keep_origin"


def test_parse_translation_payload_recovers_item_with_damaged_trailing_end_tag() -> None:
    # Actual failure mode(job ffc511 batch 2/8):Model at end of output <<<END>>>
    # Hit <<<END>>,one less >. Content intact,Keep all entries.
    content = (
"<<<ITEM item_id=a>>>\nTranslation A\n<<<END>>>\n"
"<<<ITEM item_id=b>>>\nTranslation B,Contains formulas. $x^2$.\n<<<END>>"
    )
    result = translation_client.parse_translation_payload(content)
assert result["a"]["translated_text"] == "Translation A"
assert result["b"]["translated_text"] == "Translation B,Contains formula $x^2$."


def test_parse_translation_payload_treats_next_open_tag_as_implicit_close() -> None:
    content = (
"<<<ITEM item_id=a>>>\nTranslation A\n"
"<<<ITEM item_id=b>>>\nTranslation B\n<<<END>>>"
    )
    result = translation_client.parse_translation_payload(content)
assert result["a"]["translated_text"] == "Translation A"
assert result["b"]["translated_text"] == "Translation B"


def test_parse_translation_payload_does_not_cut_literal_end_text_mid_content() -> None:
    content = "<<<ITEM item_id=a>>>\nParagraph mentions END this term and <Tag> Symbol.\n<<<END>>>"
    result = translation_client.parse_translation_payload(content)
assert result["a"]["translated_text"] == "Paragraph mentions END this term and <Tag> symbol."


def test_direct_typst_single_prompt_warns_model_about_unbalanced_source_dollars() -> None:
    # source text $ is odd(OCR Missing matching pair $)time,Provide source text to translate.
    # Semantic fix,Not directly to model — yields inevitably unbalanced translations.
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p009-b008",
            "protected_source_text": r"5a. $ ^{1}\text{H} $ NMR (CDCl $ _3 $, 400 MHz): $ \delta = 144.35, 143.01.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "Math delimiters `$` Quantity is odd." in messages[1]["content"]


def test_direct_typst_single_prompt_has_no_delimiter_warning_for_balanced_source() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"The energy is $E = mc^2$ at rest.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
assert "math delimiters" not in messages[1]["content"]


def test_direct_typst_single_prompt_lists_mitex_rewrites_found_in_source() -> None:
    # Data-driven prompt:When source formula matches a database entry.,Write the needed replacements into the prompt,
    # Model replaces at semantic layer.——Regex rewrite unreliable in complex formulas.
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"The operator $-i\hbar \partial/\partial q$ acts on $|\varPhi_0\rangle$.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    user_prompt = messages[1]["content"]
    assert "Renderer not supported." in user_prompt
    assert r"`\hbar` Switch to `ℏ`" in user_prompt
assert r"`\varPhi` Switch to `\Phi`" in user_prompt
assert r"`\rangle` Switch to `â©`" in user_prompt
    # Commands in DB not shown in this section.,should not go into the prompt
    assert r"\mathscr" not in user_prompt


def test_direct_typst_single_prompt_has_no_rewrite_hint_for_clean_source() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b002",
            "protected_source_text": r"The energy $E = mc^2$ stays constant.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
assert "Renderer not supported" not in messages[1]["content"]


def _cg_item(**overrides):
    item = {
        "item_id": "__cg__:cg-010-001",
        "translation_unit_id": "__cg__:cg-010-001",
        "translation_unit_member_ids": ["p010-b001", "p010-b002"],
        "protected_source_text": "The energy $E = mc^2$ starts and continues here.",
        "translation_unit_protected_source_text": "The energy $E = mc^2$ starts and continues here.",
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
    }
    item.update(overrides)
    return item


def test_group_members_retries_when_member_ids_are_missing() -> None:
    # Previously missing. member id Silently degrades to geometric splitting.;now retry once first,Second time.
    # If complete, use structured splitting.
    responses = iter([
        json.dumps({
            "translated_text": "Energy $E = mc^2$ starts and continues here.",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "能量 $E = mc^2$ Start"},
            ],
        }, ensure_ascii=False),
        json.dumps({
"translated_text": "Energy $E = mc^2$ starts and continues here.",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "能量 $E = mc^2$ 开始"},
                {"item_id": "p010-b002", "translated_text": "and continues here."},
            ],
        }, ensure_ascii=False),
    ])
    calls = {"n": 0}

    def _fake_request(_messages, **_kwargs):
        calls["n"] += 1
        return next(responses)

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(_cg_item())

    assert calls["n"] == 2
    members = result["__cg__:cg-010-001"]["member_translations"]
    assert [m["item_id"] for m in members] == ["p010-b001", "p010-b002"]


def test_group_members_drops_splits_when_member_math_stays_unbalanced() -> None:
    # Cross Formula member Disconnect:Overall $ Odd/even correct,but pursue member All bad.
    # If still bad after retry, discard. member Split(Explicit geometry fallback.),Keep the overall translation.
    bad = json.dumps({
"translated_text": "Energy $E = mc^2$ starts and continues here.",
        "member_translations": [
            {"item_id": "p010-b001", "translated_text": "能量 $E = mc^2 开始"},
            {"item_id": "p010-b002", "translated_text": "$ 并在此继续。"},
        ],
    }, ensure_ascii=False)

    with mock.patch.object(translation_client, "request_chat_content", return_value=bad):
        result = translation_client.translate_continuation_group_members(_cg_item())

    payload = result["__cg__:cg-010-001"]
assert payload["translated_text"] == "Energy $E = mc^2$ starts and continues here."
    assert payload["member_translations"] == []


def test_group_members_salvages_aggregate_text_from_broken_json() -> None:
    # LaTeX Caused by backslash escape corruption JSON Cannot parse:After both parsing attempts fail,
    # rescue translated_text String,Stop discarding entire segments.
    broken = (
        '{"translated_text": "Energy conservation continues here.",\n'
'"member_translations": [{"item_id": "p010-b001", "translated_text": "Energy $\\alpha Conservation."'
    )

    with mock.patch.object(translation_client, "request_chat_content", return_value=broken):
        result = translation_client.translate_continuation_group_members(_cg_item())

    payload = result["__cg__:cg-010-001"]
assert payload["translated_text"] == "Energy conservation continues here."
    assert payload["member_translations"] == []


def test_context_bleed_downgraded_to_warning_for_continuation_items() -> None:
    from services.translation.llm.validation.quality import review_translation_item

    # Consecutive segment fragments are designed without terminating punctuation.,Subsequent formula leak by apply Layer Mechanical Pruning,
    # Do not trigger expensive error-level retries.
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "the reaction rate depends on",
        "continuation_group": "cg-001",
        "translation_context_after": "the constant $k = A e^{-E_a/RT}$ as shown",
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    report = review_translation_item(item, {"decision": "translate", "translated_text": "Reaction rate depends on the constant. $k = A e^{-E_a/RT}$"})
    bleed = [i for i in report.issues if i.kind == "context_bleed"]
    assert bleed and bleed[0].severity == "warning"

    standalone = dict(item)
    standalone.pop("continuation_group")
report2 = review_translation_item(standalone, {"decision": "translate", "translated_text": "Reaction rate depends on constant $k = A e^{-E_a/RT}$"})
    bleed2 = [i for i in report2.issues if i.kind == "context_bleed"]
    assert bleed2 and bleed2[0].severity == "error"


def test_direct_typst_single_prompt_moves_scoped_terms_into_user_message() -> None:
    # Match vocab by entry, then each differs.,place system Will drop prefix cache.;
    # Matched terms item Inject user Message.
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "The SCF procedure converges quickly.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "_scoped_terms_guidance": "SCF => Self-Consistent Field",
        },
        mode="sci",
        response_style="plain_text",
    )
assert "SCF => self-consistent field" not in messages[0]["content"]
    assert "Term requirements:" in messages[1]["content"]
assert "SCF => self-consistent field" in messages[1]["content"]
