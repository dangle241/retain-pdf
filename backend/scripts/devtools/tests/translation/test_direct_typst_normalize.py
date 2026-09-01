import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.pipeline_shared.direct_typst_math import has_balanced_unescaped_dollars
from services.pipeline_shared.direct_typst_math import normalize_direct_typst_translation
from services.translation.llm.result_canonicalizer import canonicalize_batch_result


NORMALIZE_CASES = [
    {
        "name": "tight_citation_superscript",
        "source": "Previously reported.$^{[12,13]}$Show activity boost.",
"expected": "Previous studies have reported $^{[12,13]}$ showing activity improvement.",
    },
    {
        "name": "adjacent_inline_math_split",
        "source": "$a$$b$",
        "expected": "$a$ $b$",
    },
    {
        "name": "tight_prefix_and_suffix",
        "source": "Rate constant$k = A e^{-E_a/RT}$As temperature rises.",
"expected": "The rate constant $k = A e^{-E_a/RT}$ increases with temperature.",
    },
    {
        "name": "double_backslash_command_collapse",
        "source": r"Concentration $10 \\mu mol$ Reaction complete.",
"expected": r"The reaction completes when the concentration is $10 \mu mol$.",
    },
    {
        "name": "left_bracket_no_extra_space",
        "source": "（$x$）",
        "expected": "（$x$）",
    },
    {
        "name": "right_punctuation_no_extra_space",
        "source": "The result is $x$。",
"expected": "The result is $x$.",
    },
    {
        "name": "already_normalized_untouched",
        "source": "Energy $E = m c^2$ Keep conservation.",
"expected": "Energy $E = m c^2$ is conserved.",
    },
    {
        "name": "newline_inside_inline_math_collapsed",
        "source": "$k =\nA$ holds.",
"expected": "$k = A$ holds.",
    },
    {
        "name": "display_math_newline_preserved",
"source": "$$a =\nb$$ holds.",
"expected": "$$a =\nb$$ holds.",
    },
    {
        "name": "escaped_dollar_is_literal",
        "source": r"Price \$3.50 且 $x$成立。",
"expected": r"Price is \$3.50 and $x$ holds.",
    },
    {
        "name": "no_math_passthrough",
        "source": "Pure body text, no formulas.",
"expected": "Pure body text, no formulas.",
    },
    {
# Literal $ variable (such as Q-Chem's $rem input section) scanner false positive: formula span.,
        # ASCII Preserve verbatim when adjacent.,Guard test_direct_typst_protocol_shell contract.
        "name": "literal_dollar_variables_untouched",
        "source": "To enable this calculation, go to $rem Settings INCDFT = 2and use $active_orbitals Input segment.",
"expected": "To enable this calculation, set INCDFT = 2 in the $rem section and use the $active_orbitals input segment.",
    },
]


@pytest.mark.parametrize("case", NORMALIZE_CASES, ids=lambda case: case["name"])
def test_normalize_direct_typst_translation_cases(case) -> None:
    assert normalize_direct_typst_translation(case["source"]) == case["expected"]


@pytest.mark.parametrize("case", NORMALIZE_CASES, ids=lambda case: case["name"])
def test_normalize_direct_typst_translation_is_idempotent(case) -> None:
    once = normalize_direct_typst_translation(case["source"])
    assert normalize_direct_typst_translation(once) == once


def test_unbalanced_dollars_returned_unchanged_for_repair_path() -> None:
broken = "rate constant$k = A e^{-E_a/RT rises with temperature."
    assert not has_balanced_unescaped_dollars(broken)
    assert normalize_direct_typst_translation(broken) == broken


def test_canonicalize_batch_result_normalizes_direct_typst_items() -> None:
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "Previous reports$^{[12,13]}$ showed improvement.",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
    }
    result = canonicalize_batch_result(
        [item],
        {"p001-b001": {"decision": "translate", "translated_text": "Previous Reports$^{[12,13]}$Improve Display"}},
    )
assert result["p001-b001"]["translated_text"] == "Previously reported $^{[12,13]}$ showing improvement."


def test_canonicalize_batch_result_leaves_placeholder_mode_untouched() -> None:
    item = {
        "item_id": "p001-b002",
        "protected_source_text": "Rate constant[[FORMULA_1]]increases.",
        "math_mode": "placeholder",
        "metadata": {"structure_role": "body"},
    }
    result = canonicalize_batch_result(
        [item],
        {"p001-b002": {"decision": "translate", "translated_text": "rate constant$k$Temperature rises."}},
    )
    assert result["p001-b002"]["translated_text"] == "速率常数$k$随温度上升。"
