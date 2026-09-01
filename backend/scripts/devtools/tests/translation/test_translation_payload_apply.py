import sys
import json
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.apply import apply_translated_text_map
from services.translation.core.payload.translations import load_translations
from services.translation.services.results.page_io import save_pages


def test_apply_translated_text_map_unwraps_json_string_result() -> None:
    payload = [
        {
            "item_id": "demo",
            "should_translate": True,
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "demo": '{"translated_text":"Fixed text"}',
    }

    apply_translated_text_map(payload, translated)

assert payload[0]["translated_text"] == "fixed text"
assert payload[0]["protected_translated_text"] == "fixed text"
assert payload[0]["translation_unit_translated_text"] == "fixed text"
assert payload[0]["translation_unit_protected_translated_text"] == "fixed text"


def test_apply_translated_text_map_unwraps_json_string_keep_origin() -> None:
    payload = [
        {
            "item_id": "demo",
            "should_translate": True,
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "demo": '{"decision":"keep_origin","translated_text":"ignored"}',
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["final_status"] == "kept_origin"
    assert payload[0]["translated_text"] == ""


def test_apply_translated_text_map_keeps_failed_body_retryable() -> None:
    payload = [
        {
            "item_id": "p017-b010",
            "should_translate": True,
            "classification_label": "",
            "skip_reason": "",
            "source_text": "where the constant A is a combination of k, m, and $ \\hbar $ that has dimensions of energy",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "p017-b010": {
            "decision": "translate",
            "translated_text": "",
            "final_status": "failed",
            "translation_diagnostics": {
                "route_path": ["block_level", "direct_typst", "validation", "sentence_level", "keep_origin"],
                "degradation_reason": "protocol_shell_repeated",
                "fallback_to": "retry_required",
                "error_trace": [{"type": "validation", "code": "PROTOCOL_SHELL"}],
                "final_status": "failed",
            },
        }
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["should_translate"] is True
    assert payload[0]["skip_reason"] == ""
    assert payload[0]["classification_label"] == ""
    assert payload[0]["final_status"] == "failed"
    assert payload[0]["translated_text"] == ""
    assert payload[0]["translation_diagnostics"]["fallback_to"] == "retry_required"


def test_apply_translated_text_map_unwraps_batch_json_string_result() -> None:
    payload = [
        {
            "item_id": "demo",
            "should_translate": True,
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
        }
    ]
    translated = {
        "demo": '{"translations":[{"item_id":"demo","translated_text":"Batch Shell Text"}]}',
    }

    apply_translated_text_map(payload, translated)

assert payload[0]["translated_text"] == "text in batch shell"
assert payload[0]["translation_unit_translated_text"] == "text in batch shell"


def test_apply_translated_text_map_splits_group_translation_back_to_members() -> None:
    payload = [
        {
            "item_id": "p002-b001",
            "translation_unit_id": "__cg__:cg-002-002",
            "translation_unit_kind": "group",
            "should_translate": True,
            "source_text": "The advancement of complex computer programs...",
            "protected_source_text": "The advancement of complex computer programs...",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
        {
            "item_id": "p002-b002",
            "translation_unit_id": "__cg__:cg-002-002",
            "translation_unit_kind": "group",
            "should_translate": True,
            "source_text": "and energy levels; (2) revealing the surface reactivities...",
            "protected_source_text": "and energy levels; (2) revealing the surface reactivities...",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
    ]
    translated = {
        "__cg__:cg-002-002": "As more powerful computational programs and materials simulation methods develop, they have become essential tools for materials researchers.DFTComputation plays a key role in photocatalysis.",
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["translation_unit_translated_text"].startswith("Complex programs require more computation. Optimize code.")
    assert payload[0]["translated_text"]
    assert payload[1]["translated_text"]
    assert payload[0]["translated_text"] != payload[1]["translated_text"]


def test_apply_translated_text_map_uses_structured_group_member_translations() -> None:
    payload = [
        {
            "item_id": "p010-b001",
            "page_idx": 10,
            "translation_unit_id": "__cg__:cg-010-001",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["p010-b001", "p010-b002"],
            "should_translate": True,
            "source_text": "This sentence starts on the first column",
            "protected_source_text": "This sentence starts on the first column",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
        {
            "item_id": "p010-b002",
            "page_idx": 10,
            "translation_unit_id": "__cg__:cg-010-001",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["p010-b001", "p010-b002"],
            "should_translate": True,
            "source_text": "and continues on the second column.",
            "protected_source_text": "and continues on the second column.",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
    ]
    translated = {
        "__cg__:cg-010-001": {
            "translated_text": "This sentence starts in the first column and continues in the second column.",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "Text align left."},
                {"item_id": "p010-b002", "translated_text": "Continue in second column."},
            ],
            "translation_diagnostics": {
                "route_path": ["block_level", "continuation_group"],
            },
        }
    }

    apply_translated_text_map(payload, translated)

assert payload[0]["translated_text"] == "This sentence starts from the first column"
assert payload[1]["translated_text"] == "and continues in the second column."
assert payload[0]["group_translated_text"] == "This sentence starts from the first column, and continues in the second column."
    assert payload[0]["translation_diagnostics"]["group_member_translation_source"] == "structured"
    assert payload[1]["translation_diagnostics"]["group_member_translation_source"] == "structured"


def test_save_pages_preserves_cross_page_group_translation_units(tmp_path) -> None:
    page_payloads = {
        0: [
            {
                "item_id": "p001-b010",
                "page_idx": 0,
                "translation_unit_id": "__cg__:cg-cross",
                "translation_unit_kind": "group",
                "translation_unit_member_ids": ["p001-b010", "p002-b001"],
                "continuation_group": "cg-cross",
                "should_translate": True,
                "source_text": "The expression starts here",
                "protected_source_text": "The expression starts here",
                "protected_map": [],
                "formula_map": [],
                "translation_unit_protected_map": [],
                "translation_unit_formula_map": [],
                "translation_unit_protected_translated_text": "The expression starts here and ends on the next page.",
"translation_unit_translated_text": "The expression starts here and ends on the next page.",
                "group_protected_source_text": "The expression starts here and ends there.",
                "group_formula_map": [],
                "group_protected_map": [],
"group_protected_translated_text": "The expression starts here and ends on the next page.",
"group_translated_text": "The expression starts here and ends on the next page.",
                "protected_translated_text": "The expression starts here,",
"translated_text": "The expression starts here,",
                "final_status": "translated",
            }
        ],
        1: [
            {
                "item_id": "p002-b001",
                "page_idx": 1,
                "translation_unit_id": "__cg__:cg-cross",
                "translation_unit_kind": "group",
                "translation_unit_member_ids": ["p001-b010", "p002-b001"],
                "continuation_group": "cg-cross",
                "should_translate": True,
                "source_text": "and ends there.",
                "protected_source_text": "and ends there.",
                "protected_map": [],
                "formula_map": [],
                "translation_unit_protected_map": [],
                "translation_unit_formula_map": [],
"translation_unit_protected_translated_text": "The expression starts here and ends on the next page.",
"translation_unit_translated_text": "The expression starts here and ends on the next page.",
                "group_protected_source_text": "The expression starts here and ends there.",
                "group_formula_map": [],
                "group_protected_map": [],
"group_protected_translated_text": "The expression starts here and ends on the next page.",
"group_translated_text": "The expression starts here and ends on the next page.",
                "protected_translated_text": "End on next page.",
"translated_text": "and ends on the next page.",
                "final_status": "translated",
            }
        ],
    }
    paths = {0: tmp_path / "page-001.json", 1: tmp_path / "page-002.json"}

    save_pages(page_payloads, paths, {0})
    persisted = json.loads(paths[0].read_text(encoding="utf-8"))

    assert persisted[0]["translation_unit_id"] == "__cg__:cg-cross"
    assert persisted[0]["translation_unit_kind"] == "group"
    assert persisted[0]["translation_unit_member_ids"] == ["p001-b010", "p002-b001"]
assert persisted[0]["group_protected_translated_text"] == "The expression starts here and ends on the next page."
assert persisted[0]["translated_text"] == "The expression starts here,"


def test_apply_translated_text_map_preserves_group_result_status_and_diagnostics() -> None:
    payload = [
        {
            "item_id": "p004-b030",
            "page_idx": 4,
            "translation_unit_id": "__cg__:cg-004-005",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["p004-b030", "p004-b031"],
            "should_translate": True,
            "source_text": "Following Stewart's Gaussian expansions,",
            "protected_source_text": "Following Stewart's Gaussian expansions,",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
        {
            "item_id": "p004-b031",
            "page_idx": 5,
            "translation_unit_id": "__cg__:cg-004-005",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["p004-b030", "p004-b031"],
            "should_translate": True,
            "source_text": "which are used to approximate a spherical Slater-type orbital.",
            "protected_source_text": "which are used to approximate a spherical Slater-type orbital.",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_map": [],
            "group_formula_map": [],
        },
    ]
    translated = {
        "__cg__:cg-004-005": {
            "translated_text": "Follow Stewart Gaussian expansion. Unnecessary. Simplify.ϕκ Use spherical harmonics expansion. Simplify: avoid unnecessary complexity, add when higher accuracy required. Slater Track type.",
            "final_status": "partially_translated",
            "translation_diagnostics": {
                "route_path": ["block_level", "continuation_group"],
                "final_status": "partially_translated",
            },
        }
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["final_status"] == "partially_translated"
    assert payload[1]["final_status"] == "partially_translated"
    assert payload[0]["translation_diagnostics"]["item_id"] == "p004-b030"
    assert payload[1]["translation_diagnostics"]["item_id"] == "p004-b031"
    assert payload[0]["translation_diagnostics"]["page_idx"] == 4
    assert payload[1]["translation_diagnostics"]["page_idx"] == 5


def test_apply_translated_text_map_applies_single_result_without_collapsing_preserved_group() -> None:
    payload = [
        {
            "item_id": "p002-b001",
            "translation_unit_id": "__cg__:cg-stale",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["p002-b001", "ghost"],
            "continuation_group": "cg-stale",
            "should_translate": True,
            "source_text": "Body text.",
            "protected_source_text": "Body text.",
            "protected_map": [],
            "formula_map": [],
            "translation_unit_protected_map": [],
            "translation_unit_formula_map": [],
            "group_protected_source_text": "stale",
            "group_formula_map": [{"placeholder": "<f1-a7c/>"}],
            "group_protected_map": [{"token_tag": "<f1-a7c/>"}],
            "group_protected_translated_text": "stale",
            "group_translated_text": "stale",
        }
    ]
    translated = {
        "p002-b001": "Fixed single-member text",
    }

    apply_translated_text_map(payload, translated)

    assert payload[0]["translation_unit_id"] == "__cg__:cg-stale"
    assert payload[0]["translation_unit_kind"] == "group"
    assert payload[0]["translation_unit_member_ids"] == ["p002-b001"]
    assert payload[0]["translated_text"] == "Fixed single-member text"


def test_load_translations_sanitizes_persisted_json_shell(tmp_path) -> None:
    path = tmp_path / "page-030-deepseek.json"
    path.write_text(
        """
        [
          {
            "item_id": "p030-b010",
            "translated_text": "{\\"translations\\":[{\\"item_id\\":\\"p030-b010\\",\\"translated_text\\":\\"(1) computational efficiency, cost, and accuracy.\\"}]}",
            "protected_translated_text": "{\\"translated_text\\":\\"(1) 计算效率、成本与精度。\\"}"
          }
        ]
        """,
        encoding="utf-8",
    )

    payload = load_translations(path, strict_contract=False)

assert payload[0]["translated_text"] == "(1) computational efficiency, cost, and accuracy."
assert payload[0]["protected_translated_text"] == "(1) computational efficiency, cost, and accuracy."
    assert "translations" not in path.read_text(encoding="utf-8")


def test_load_translations_preserves_persisted_external_group_metadata(tmp_path) -> None:
    path = tmp_path / "page-001-deepseek.json"
    path.write_text(
        json.dumps(
            [
                {
                    "item_id": "p001-b010",
                    "page_idx": 0,
                    "block_kind": "text",
                    "layout_role": "paragraph",
                    "semantic_role": "body",
                    "structure_role": "body",
                    "policy_translate": True,
                    "asset_id": "",
                    "reading_order": 10,
                    "raw_block_type": "text",
                    "normalized_sub_type": "",
                    "translation_unit_id": "__cg__:cg-cross",
                    "translation_unit_kind": "group",
                    "translation_unit_member_ids": ["p001-b010", "p002-b001"],
                    "continuation_group": "cg-cross",
                    "should_translate": True,
                    "source_text": "The expression starts here",
                    "protected_source_text": "The expression starts here",
                    "protected_map": [],
                    "formula_map": [],
                    "translation_unit_protected_map": [],
                    "translation_unit_formula_map": [],
"translation_unit_protected_translated_text": "The expression starts here and ends on the next page.",
"translation_unit_translated_text": "The expression starts here and ends on the next page.",
                    "group_protected_source_text": "The expression starts here and ends there.",
                    "group_formula_map": [],
                    "group_protected_map": [],
"group_protected_translated_text": "The expression starts here and ends on the next page.",
"group_translated_text": "The expression starts here and ends on the next page.",
"protected_translated_text": "The expression starts here,",
"translated_text": "The expression starts here,",
                    "final_status": "translated",
                }
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    payload = load_translations(path)

    assert payload[0]["translation_unit_id"] == "__cg__:cg-cross"
    assert payload[0]["translation_unit_kind"] == "group"
    assert payload[0]["translation_unit_member_ids"] == ["p001-b010", "p002-b001"]
assert payload[0]["group_protected_translated_text"] == "The expression starts here and ends on the next page."
assert payload[0]["translated_text"] == "The expression starts here,"
