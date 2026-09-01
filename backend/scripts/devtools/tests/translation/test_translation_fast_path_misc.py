import sys
from dataclasses import replace
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm import placeholder_guard
from services.translation.llm.providers.deepseek.client import _extract_stream_delta_text
from services.translation.llm.shared import cache
from services.translation.llm.shared.orchestration import segment_routing
from services.translation.llm.shared.orchestration.intentional_keep_origin import (
    keep_origin_payload_for_repeated_empty_translation,
)
from services.translation.core.payload.parts.apply import apply_translated_text_map
from services.translation.services.policy import should_fast_path_keep_origin


def test_citation_rich_body_text_still_forces_translation() -> None:
    source_text = (
        "For infilling tasks, we attempt to query the LLaMA model with the prompt given the "
        "<prefix> and <suffix>, please answer the <middle> part, which includes both prefix and "
        "suffix information. However, this approach is no better than simply completing the prefix, "
        "likely because the LLaMA model needs tuning for filling in the middle (FIM; Bavarian et al. "
        "2022b). Additionally, Bavarian et al. (2022b) notes that using AR models for infilling "
        "presents challenges, such as prompting difficulties and repetition. In contrast, DLMs are "
        "naturally suited for this task, as they are trained to handle masked inputs, which is a key advantage."
    )
    item = {
        "item_id": "p024-b008",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": source_text,
        "protected_source_text": source_text,
    }

    assert placeholder_guard.should_force_translate_body_text(item)
    assert placeholder_guard.looks_like_untranslated_english_output(item, source_text)


def test_apply_translation_salvages_reasoning_leak_final_answer() -> None:
    payload = [
        {
            "item_id": "p112-b011",
            "page_idx": 111,
            "block_type": "text",
            "block_kind": "text",
            "source_text": "with a radial response function K and a corresponding inhomogeneity Qxc,",
            "protected_source_text": "with a radial response function K and a corresponding inhomogeneity Qxc,",
            "should_translate": True,
            "formula_map": [],
            "protected_map": [],
        }
    ]
    leaked = (
"Keep it concise. According to the rules, K and Qxc should use math mode. So output directly."
        "Note: the original ends with a comma; the translation should also keep the comma."
        "In summary, output. Has radial response function. $K$ and corresponding non-uniform terms $Q_{\\mathrm{xc}}$，"
    )

    apply_translated_text_map(payload, {"p112-b011": leaked})

    assert payload[0]["translated_text"] == "Radial response function $K$ and corresponding non-uniform terms $Q_{\\mathrm{xc}}$，"
    assert payload[0]["final_status"] == "partially_translated"
    assert payload[0]["translation_diagnostics"]["degradation_reason"] == "reasoning_leak_salvaged"


def test_apply_translation_salvages_quoted_reasoning_choice() -> None:
    payload = [
        {
            "item_id": "p135-b009",
            "page_idx": 134,
            "block_type": "text",
            "block_kind": "text",
            "source_text": "The time-ordered response has to be distinguished from the retarded response function,",
            "protected_source_text": "The time-ordered response has to be distinguished from the retarded response function,",
            "should_translate": True,
            "formula_map": [],
            "protected_map": [],
        }
    ]
    leaked = (
'Does the function need "function"? Original text is "time-ordered response", but later there is "response function".'
'For accuracy, can translate as "The time-ordered response (function) must be distinguished from the retarded response function"Provide the source text to translate.'
'More concise: directly "The time-ordered response must be distinguished from the retarded response function" because the latter is explicitly a function.'
        '\n\nConsidering academic norms, use"加以区分"more formal. I choose:"时间有序响应必须与推迟响应函数加以区分，"'
    )

    apply_translated_text_map(payload, {"p135-b009": leaked})

assert payload[0]["translated_text"] == "The time-ordered response must be distinguished from the retarded response function,"
    assert payload[0]["final_status"] == "partially_translated"
    assert payload[0]["translation_diagnostics"]["degradation_reason"] == "reasoning_leak_salvaged"


def test_deepseek_stream_delta_ignores_reasoning_content() -> None:
    data = {
        "choices": [
            {
                "delta": {
                    "reasoning_content": "Model thinking—do not translate.",
"content": "The time-ordered response must be distinguished from the retarded response function,",
                }
            }
        ]
    }

assert _extract_stream_delta_text(data) == "The time-ordered response must be distinguished from the retarded response function,"


def test_apply_translation_trims_direct_typst_neighbor_continuation_leak() -> None:
    payload = [
        {
            "item_id": "p125-b018",
            "page_idx": 124,
            "block_type": "text",
            "block_kind": "text",
            "source_text": r"For simplicity, consider a homonuclear neutral diatomic molecule AB, with nuclear charges $ \lambda Z_A $, $ Z_B $, number of electrons $ \lambda Z_A + Z_B $, at fixed internuclear distance R. We wish to prove that the binding energy",
            "protected_source_text": r"For simplicity, consider a homonuclear neutral diatomic molecule AB, with nuclear charges $ \lambda Z_A $, $ Z_B $, number of electrons $ \lambda Z_A + Z_B $, at fixed internuclear distance R. We wish to prove that the binding energy",
            "should_translate": True,
            "formula_map": [],
            "protected_map": [],
        },
        {
            "item_id": "p125-b021",
            "page_idx": 124,
            "block_type": "text",
            "block_kind": "text",
            "source_text": r"is positive for $ \lambda = 1 $. To do this we shall use",
            "protected_source_text": r"is positive for $ \lambda = 1 $. To do this we shall use",
            "should_translate": True,
            "formula_map": [],
            "protected_map": [],
        },
    ]
    leaked = (
        r"Consider homonuclear diatomic moleculeABwhose nuclear charges are respectively$ \lambda Z_A $和$ Z_B $，"
        r"Electron count$ \lambda Z_A + Z_B $nuclear distanceRFixed. We want to prove that the binding energy is in$ \lambda = 1 $Time is correct."
        r"Use stdlib `pathlib.Path` for path ops. Hellmann-Feynman Theorem. Therefore,"
    )

    apply_translated_text_map(payload, {"p125-b018": leaked})

    assert payload[0]["translated_text"].endswith("We aim to prove binding energy.")
    assert r"$ \lambda = 1 $" not in payload[0]["translated_text"]
    assert payload[0]["final_status"] == "partially_translated"
    assert payload[0]["translation_diagnostics"]["degradation_reason"] == "neighbor_continuation_leak_trimmed"


def test_repeated_empty_translation_degrades_to_keep_origin() -> None:
    payload = keep_origin_payload_for_repeated_empty_translation(
        {
            "item_id": "p001-b017",
            "page_idx": 0,
            "block_type": "text",
        }
    )
    assert payload["p001-b017"]["decision"] == "keep_origin"
    assert payload["p001-b017"]["final_status"] == "kept_origin"
    assert (
        payload["p001-b017"]["translation_diagnostics"]["degradation_reason"]
        == "empty_translation_repeated"
    )


def test_special_long_contributor_list_fast_paths_keep_origin() -> None:
    names = ", ".join(f"Contributor {index} $ ^{{{index}}} $" for index in range(1, 120))
    item = {
        "item_id": "p016-b005",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "protected_source_text": f"Data Contributors. {names}",
        "translation_unit_protected_source_text": f"Data Contributors. {names}",
        "should_translate": True,
    }

    should_skip, reason = should_fast_path_keep_origin(item)

    assert should_skip is True
    assert reason == "special_long_list_block"


def test_special_long_numbered_affiliation_list_fast_paths_keep_origin() -> None:
    affiliations = " ".join(
        f"{index}. University of Example {index}, Department of Computer Science, Research Lab"
        for index in range(1, 90)
    )
    item = {
        "item_id": "p017-b001",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "protected_source_text": affiliations,
        "translation_unit_protected_source_text": affiliations,
        "should_translate": True,
    }

    should_skip, reason = should_fast_path_keep_origin(item)

    assert should_skip is True
    assert reason == "special_long_list_block"


def test_special_long_author_name_list_fast_paths_keep_origin() -> None:
    authors = ", ".join(
        f"Firstname Lastname"
        for index in range(1, 160)
    )
    item = {
        "item_id": "p001-b014",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "protected_source_text": authors,
        "translation_unit_protected_source_text": authors,
        "should_translate": True,
    }

    should_skip, reason = should_fast_path_keep_origin(item)

    assert should_skip is True
    assert reason == "special_long_list_block"


def test_long_normal_body_paragraph_does_not_fast_path_keep_origin() -> None:
    paragraph = " ".join(
        "This paragraph explains benchmark construction, evaluation design, and deployment implications in a continuous prose form."
        for _ in range(70)
    )
    item = {
        "item_id": "p020-b001",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "protected_source_text": paragraph,
        "translation_unit_protected_source_text": paragraph,
        "should_translate": True,
    }

    should_skip, reason = should_fast_path_keep_origin(item)

    assert should_skip is False
    assert reason == ""


def test_translation_cache_prompt_hash_includes_plain_text_prompt_files() -> None:
    original_load_prompt = cache.load_prompt

    def fake_load_prompt(name: str) -> str:
        text = original_load_prompt(name)
        if name == "translation_task_plain_text.txt":
            return f"{text}\nCACHE TEST MUTATION"
        return text

    item = {
        "item_id": "p001-b001",
        "translation_unit_protected_source_text": "This is a source sentence.",
    }
    before = cache.cache_key_for_item(
        item,
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )
    with mock.patch.object(cache, "load_prompt", side_effect=fake_load_prompt):
        cache._PROMPT_HASHES.clear()
        after = cache.cache_key_for_item(
            item,
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            mode="sci",
        )
    cache._PROMPT_HASHES.clear()

    assert before != after


def test_formula_segment_route_prefers_plain_for_small_segment_count() -> None:
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "After <f1-a7c/> hours, activity increased and <f2-b2d/> remained stable.",
    }
    policy = segment_routing.SegmentationPolicy(
        prefer_plain_when_segment_count_leq=6,
        small_formula_inline_enabled=False,
    )
    assert segment_routing.formula_segment_translation_route(item, policy=policy) == "none"


def test_direct_typst_skips_heavy_formula_split_entry() -> None:
    from services.translation.llm.shared import control_context
    from services.translation.llm.shared.orchestration import route_selection

    item = {
        "item_id": "p001-b002",
        "page_idx": 0,
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
        "protected_source_text": r"Observe $\mathrm{Ph(i-PrO)SiH_2}$ and more text.",
        "translation_unit_protected_source_text": r"Observe $\mathrm{Ph(i-PrO)SiH_2}$ and more text.",
    }
    context = control_context.build_translation_control_context(mode="sci")

    with mock.patch.object(route_selection, "heavy_formula_split_reason", side_effect=AssertionError("should not be called")):
        route = route_selection.select_single_item_route(item, context=context)

    assert route.direct_typst
    assert route.heavy_formula_split_reason == ""


def test_english_residue_degrades_to_keep_origin_after_sentence_fallback_failure() -> None:
    from services.translation.llm.shared import control_context
    from services.translation.llm.shared.orchestration import fallbacks

    item = {
        "item_id": "p001-b002",
        "page_idx": 0,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "protected_source_text": "This is the first sentence. This is the second sentence.",
        "translation_unit_protected_source_text": "This is the first sentence. This is the second sentence.",
    }
    context = control_context.build_translation_control_context(mode="sci")
    context = replace(
        context,
        fallback_policy=replace(
            context.fallback_policy,
            plain_text_attempts=1,
            allow_tagged_placeholder_retry=False,
        ),
    )
    english_residue = fallbacks.EnglishResidueError("p001-b002")

    with mock.patch.object(fallbacks, "translate_single_item_plain_text", side_effect=english_residue):
        with mock.patch.object(fallbacks, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
            with mock.patch.object(
                fallbacks,
                "_sentence_level_fallback",
                side_effect=fallbacks.PlaceholderInventoryError("p001-b002", [], []),
            ):
                result = fallbacks.translate_single_item_plain_text_with_retries(
                    item,
                    api_key="",
                    model="deepseek-chat",
                    base_url="https://api.deepseek.com/v1",
                    request_label="test",
                    context=context,
                    diagnostics=None,
                )

    payload = result["p001-b002"]
    assert payload["decision"] == "translate"
    assert payload["final_status"] == "failed"
    assert payload["translation_diagnostics"]["degradation_reason"] == "english_residue_repeated"
    assert payload["translation_diagnostics"]["final_status"] == "failed"
