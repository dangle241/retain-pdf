from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm import placeholder_guard
from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.shared import structured_models
from services.translation.llm.shared import structured_output
from services.translation.llm.shared import structured_parsers
from services.translation.llm.shared.orchestration import segment_routing


def test_single_item_extractor_returns_plain_text_when_not_json() -> None:
    assert (
        deepseek_client.extract_single_item_translation_text("Direct return Chinese translation.", "p001-b019")
        == "This is the Chinese translation returned directly."
    )


def test_single_item_extractor_unwraps_nested_batch_json_shell() -> None:
    nested = {
        "translated_text": json.dumps(
            {
                "translations": [
                    {
                        "item_id": "p030-b010",
"translated_text": "Computational efficiency, cost, and accuracy.",
                    }
                ]
            },
            ensure_ascii=False,
        )
    }
    assert (
        deepseek_client.extract_single_item_translation_text(json.dumps(nested, ensure_ascii=False), "p030-b010")
        == "Computational efficiency, cost, and accuracy."
    )


def test_single_item_extractor_rejects_broken_protocol_shell() -> None:
    broken = '{"translations":[{"item_id":"p001-b019","translated_text":"Unclosed protocol envelope."'

    with pytest.raises(Exception):
        deepseek_client.extract_single_item_translation_text(broken, "p001-b019")


def test_single_item_extractor_allows_plain_text_with_references() -> None:
    text = "This conclusion can be derived from Lehmann denotes [94, 95]。"

    assert deepseek_client.extract_single_item_translation_text(text, "p001-b019") == text


def test_english_residue_detector_only_blocks_copy_dominant_english_output() -> None:
    item = {
        "item_id": "p002-b001",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": (
            "The advancement of complex computer programs with faster computing power and material simulation methods "
            "has become an important tool for material researchers, because it explains many properties."
        ),
    }
    translated = (
        "The advancement of complex computer programs with faster computing power and material simulation methods "
        "remains important."
    )
    assert not placeholder_guard.looks_like_untranslated_english_output(item, translated)
    assert placeholder_guard.looks_like_predominantly_english_output(item, translated)


def test_english_residue_detector_only_warns_for_mixed_output_with_english_span() -> None:
    item = {
        "item_id": "p009-b067",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": (
            "Olefins offer the unique benefit of starting from prochiral carbons rather than preformed "
            "tetrasubstituted carbons like tertiary alkyl bromides, which can be laborious to synthesize or unstable."
        ),
    }
    translated = (
        "This is an important advantage. Olefins offer the unique benefit of starting from prochiral carbons rather than "
        "preformed tetrasubstituted carbons like tertiary alkyl bromides, which can be laborious to synthesize or unstable. "
        "Subsequent substrates also couple smoothly."
    )
    assert not placeholder_guard.looks_like_untranslated_english_output(item, translated)
    assert placeholder_guard.looks_like_mixed_english_residue_output(item, translated)
    assert placeholder_guard.looks_like_predominantly_english_output(item, translated)


def test_english_residue_detector_ignores_author_name_list() -> None:
    item = {
        "item_id": "p001-b002",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": (
            "Samantha A. Green, Steven W. M. Crossley, Jeishla L. M. Matos, "
            "Suhelen Vásquez-Céspedes, Sophia L. Shevick, and Ryan A. Shenvi*"
        ),
    }
    assert not placeholder_guard.looks_like_untranslated_english_output(
        item,
        "Samantha A. Green, Steven W. M. Crossley, Jeishla L. M. Matos, "
        "Suhelen Vásquez-Céspedes, Sophia L. Shevick, and Ryan A. Shenvi*",
    )


def test_english_residue_guard_ignores_reference_like_entries() -> None:
    item = {
        "item_id": "p011-b009",
        "block_type": "text",
        "metadata": {
            "structure_role": "body",
            "source": {"raw_type": "ref_text"},
        },
        "translation_unit_protected_source_text": (
            "Gregor Bachmann and Vaishnavh Nagarajan. The pitfalls of next-token prediction. "
            "In Forty-first International Conference on Machine Learning, ICML, 2024."
        ),
    }
    translated = (
        "Gregor Bachmann and Vaishnavh Nagarajan. Next-word prediction pitfalls.. "
        "In Forty-first International Conference on Machine Learning, ICML, 2024."
    )
    assert not placeholder_guard.looks_like_untranslated_english_output(item, translated)


def test_formula_dense_body_with_partial_chinese_is_not_treated_as_english_residue() -> None:
    item = {
        "item_id": "p003-b011",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": (
            "For the diffusion process <f1-a11/>, the transition matrix <f2-b22/> governs token updates, "
            "while the marginal probability <f3-c33/> controls the corruption level and the posterior estimator "
            "<f4-d44/> is combined with <f5-e55/> to stabilize training."
        ),
        "formula_map": [{"placeholder": "<f1-a11/>"}],
        "translation_unit_formula_map": [{"placeholder": "<f1-a11/>"}],
    }
    translated = (
"For the diffusion process <f1-a11/>, transition matrix <f2-b22/> controls token Update, (with comma). I'll output exactly that.Update,"
"and marginal probability <f3-c33/> and posterior estimator <f4-d44/> joint stable training."
    )
    assert not placeholder_guard.looks_like_predominantly_english_output(item, translated)
    assert not placeholder_guard.looks_like_mixed_english_residue_output(item, translated)


def test_term_preserving_formula_body_is_not_treated_as_english_residue() -> None:
    item = {
        "item_id": "p007-b014",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": (
            "The barrier from B3LYP/6-311G** is reported as <f1-a11/>, while GC-FID and MP2/6-311G "
            "measurements provide <f2-b22/> for comparison."
        ),
        "formula_map": [{"placeholder": "<f1-a11/>"}, {"placeholder": "<f2-b22/>"}],
        "translation_unit_formula_map": [{"placeholder": "<f1-a11/>"}, {"placeholder": "<f2-b22/>"}],
    }
    translated = (
"B3LYP/6-311G** calculated barrier is <f1-a11/>while GC-FID and MP2/6-311G measurement results provided. "
        "<f2-b22/> For comparison."
    )
    assert not placeholder_guard.looks_like_predominantly_english_output(item, translated)
    assert not placeholder_guard.looks_like_mixed_english_residue_output(item, translated)


def test_structured_output_repairs_trailing_commas_and_unquoted_keys() -> None:
    payload = structured_output.parse_structured_json(
        """
        ```json
        {domain: "chemistry", summary: "ok", translation_guidance: "keep terms",}
        ```
        """
    )
    assert payload["domain"] == "chemistry"
    assert payload["summary"] == "ok"


def test_domain_context_parser_accepts_line_key_value_fallback() -> None:
    result = structured_parsers.parse_domain_context_response(
        "DOMAIN: materials science\nSUMMARY: photocatalysis paper\nTRANSLATION_GUIDANCE: preserve formulas",
        preview_text="preview",
    )
    assert result["domain"] == "materials science"
    assert result["summary"] == "photocatalysis paper"
    assert result["translation_guidance"] == "preserve formulas"


def test_domain_context_parser_salvages_fields_from_malformed_json() -> None:
    content = """
    Here is the result:
    {
      "domain": "computational chemistry",
      "summary": "A materials-modeling paper with equation-heavy prose."
      "translation_guidance": "Keep terms, abbreviations, and formula notations; do not paraphrase."
    }
    """
    result = structured_parsers.parse_domain_context_response(content, preview_text="preview")
    assert result["domain"] == "computational chemistry"
    assert result["summary"] == "A materials-modeling paper with equation-heavy prose."
assert result["translation_guidance"] == "Keep terminology, abbreviations, and formula notation; do not paraphrase."


def test_placeholder_guard_canonicalizes_nested_json_shell() -> None:
    result = placeholder_guard.canonicalize_batch_result(
        [{"item_id": "p030-b010", "translation_unit_protected_source_text": "Computational efficiency."}],
        {
            "p030-b010": {
                "decision": "translate",
                "translated_text": json.dumps(
                    {
                        "translations": [
                            {
                                "item_id": "p030-b010",
"translated_text": "Computational efficiency, cost, and accuracy.",
                            }
                        ]
                    },
                    ensure_ascii=False,
                ),
            }
        },
    )
assert result["p030-b010"]["translated_text"] == "Computational efficiency, cost, and accuracy."


def test_placeholder_guard_rejects_protocol_shell_output() -> None:
    with pytest.raises(placeholder_guard.TranslationProtocolError):
        placeholder_guard.validate_batch_result(
            [{"item_id": "p030-b010", "translation_unit_protected_source_text": "Computational efficiency."}],
            {
                "p030-b010": {
                    "decision": "translate",
                    "translated_text": '{ "translations": [{"item_id":"p030-b010","translated_text":"computational efficiency"}] }',
                }
            },
        )


def test_placeholder_guard_rejects_unbalanced_direct_typst_math_delimiters() -> None:
    with pytest.raises(placeholder_guard.MathDelimiterError):
        placeholder_guard.validate_batch_result(
            [
                {
                    "item_id": "p021-b005",
                    "math_mode": "direct_typst",
                    "translation_unit_protected_source_text": "Text with $ m' $ math.",
                }
            ],
            {
                "p021-b005": {
                    "decision": "translate",
                    "translated_text": "Contains corrupted $ m' Math snippet.",
                }
            },
        )


def test_placeholder_guard_rejects_direct_typst_following_context_math_bleed() -> None:
    item = {
        "item_id": "p125-b018",
        "math_mode": "direct_typst",
        "translation_unit_protected_source_text": (
            r"For simplicity, consider a homonuclear neutral diatomic molecule AB. "
            r"We wish to prove that the binding energy"
        ),
        "translation_context_after": r"is positive for $ \lambda = 1 $. To do this we shall use",
    }

    with pytest.raises(placeholder_guard.TranslationProtocolError):
        placeholder_guard.validate_batch_result(
            [item],
            {
                "p125-b018": {
                    "decision": "translate",
                    "translated_text": r"For simplicity, consider a homonuclear neutral diatomic molecule.ABWe want to prove that binding energy can$ \lambda = 1 $Current time.",
                }
            },
        )


def test_placeholder_guard_rejects_model_request_prompt_output() -> None:
    with pytest.raises(placeholder_guard.TranslationProtocolError):
        placeholder_guard.validate_batch_result(
            [
                {
                    "item_id": "p014-b014",
                    "math_mode": "direct_typst",
                    "translation_unit_protected_source_text": "……",
                }
            ],
            {
                "p014-b014": {
                    "decision": "translate",
                    "translated_text": "Please provide the original text to be translated.",
                }
            },
        )


def test_placeholder_guard_allows_legitimate_source_text_request_sentence() -> None:
    placeholder_guard.validate_batch_result(
        [
            {
                "item_id": "p014-b015",
                "math_mode": "direct_typst",
                "translation_unit_protected_source_text": "The form asks users to provide the source text before submitting.",
            }
        ],
        {
            "p014-b015": {
                "decision": "translate",
                "translated_text": "This form requires the user to provide the original text before submitting.",
            }
        },
    )


def test_translation_and_formula_outputs_use_strict_json_schema_format() -> None:
    for schema in [
        structured_models.TRANSLATION_BATCH_RESPONSE_SCHEMA,
        structured_models.TRANSLATION_SINGLE_TEXT_RESPONSE_SCHEMA,
        structured_models.TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA,
        structured_models.FORMULA_SEGMENT_RESPONSE_SCHEMA,
    ]:
        assert schema["type"] == "json_schema"
        assert schema["json_schema"]["strict"]


def test_formula_segment_parser_accepts_schema_json_payload() -> None:
    result = segment_routing.parse_segment_translation_payload(
        '{"segments":[{"segment_id":"1","translated_text":"First paragraph"},{"segment_id":"2","translated_text":"Second paragraph"}]}',
        expected_segments=[
            {"segment_id": "1", "source_text": "first"},
            {"segment_id": "2", "source_text": "second"},
        ],
    )
    assert result == {"1": "Paragraph 1", "2": "Second paragraph"}
