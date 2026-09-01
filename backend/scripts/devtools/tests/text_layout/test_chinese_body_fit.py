from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.chinese_body_fit import estimate_chinese_body_height_pt
from services.rendering.layout.chinese_body_fit import estimate_chinese_body_lines
from services.rendering.layout.chinese_body_fit import formula_unit_ratio
from services.rendering.layout.chinese_body_fit import solve_chinese_body_font_size_pt
from services.rendering.layout.chinese_body_fit import tokenize_chinese_body_text


def test_chinese_body_line_count_uses_bbox_width() -> None:
    text = "This paragraph tests Chinese text width estimation. Narrower width results more line breaks."

    wide_lines, _ = estimate_chinese_body_lines(240.0, text, [], 10.0)
    narrow_lines, _ = estimate_chinese_body_lines(80.0, text, [], 10.0)

    assert narrow_lines > wide_lines


def test_chinese_body_solver_reduces_font_when_height_is_tight() -> None:
    text = "This is a longer Chinese body paragraph that needs to be based on bbox Estimate line count from width, then derive usable font size from height."

    loose = solve_chinese_body_font_size_pt(
        180.0,
        90.0,
        text,
        [],
        leading_em=0.6,
        min_font_size_pt=8.0,
        max_font_size_pt=11.0,
    )
    tight = solve_chinese_body_font_size_pt(
        180.0,
        42.0,
        text,
        [],
        leading_em=0.6,
        min_font_size_pt=8.0,
        max_font_size_pt=11.0,
    )

    assert loose.font_size_pt > tight.font_size_pt
    assert tight.estimated_height_pt <= 42.0


def test_formula_lines_add_height_pressure() -> None:
text = "where __FORMULA_1__ represents the energy difference, and the following text continues to explain this condition."
    formula_map = [{"placeholder": "__FORMULA_1__", "formula_text": r"\\Delta E_{IJ}(\\mathbf{R}) = 0"}]

    without_formula = estimate_chinese_body_height_pt(160.0, text.replace("__FORMULA_1__", "Energy difference"), [], 10.0, 0.6)
    with_formula = estimate_chinese_body_height_pt(160.0, text, formula_map, 10.0, 0.6)

    assert with_formula.estimated_height_pt > without_formula.estimated_height_pt
    assert with_formula.formula_ratio > 0


def test_tokenizer_distinguishes_chinese_ascii_punctuation_and_formula() -> None:
tokens = tokenize_chinese_body_text("Fig. 3. g-h Flat __FORMULA_1__", [{"placeholder": "__FORMULA_1__", "formula_text": "g-h"}])

    assert any(token.formula for token in tokens)
assert any(token.text == "Fig" for token in tokens)
    assert any(token.text == "g-h" for token in tokens)


def test_tokenizer_treats_dollar_inline_math_as_formula() -> None:
    tokens = tokenize_chinese_body_text(r"along $g-h(\mathbf{R}_x)$ paths,", [])

    formula_tokens = [token for token in tokens if token.formula]
    assert len(formula_tokens) == 1
    assert formula_tokens[0].text == r"$g-h(\mathbf{R}_x)$"


def test_formula_heavy_text_lowers_fit_confidence() -> None:
text = "__FORMULA_1__ and __FORMULA_2__ determine __FORMULA_3__ changes in."
    formula_map = [
        {"placeholder": "__FORMULA_1__", "formula_text": r"g^{IJ}(R_x)"},
        {"placeholder": "__FORMULA_2__", "formula_text": r"h^{IJ}(R_x)"},
        {"placeholder": "__FORMULA_3__", "formula_text": r"\\delta\\mathbf{R}"},
    ]

    result = estimate_chinese_body_height_pt(160.0, text, formula_map, 10.0, 0.6)

    assert formula_unit_ratio(text, formula_map) > 0.35
    assert result.confidence < 0.5
    assert result.max_safe_shrink_pt <= 0.2
