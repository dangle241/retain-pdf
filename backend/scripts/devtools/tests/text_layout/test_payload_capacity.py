from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.capacity import formula_estimate_discount


def test_formula_estimate_discount_keeps_plain_text_unchanged() -> None:
    assert formula_estimate_discount("This is ordinary text.", []) == 1.0


def test_formula_estimate_discount_is_continuous_and_bounded() -> None:
    formula_map = [
        {"placeholder": "[[FORMULA_1]]", "formula_text": r"x_1"},
        {"placeholder": "[[FORMULA_2]]", "formula_text": r"\\frac{\\partial E}{\\partial R}"},
        {"placeholder": "[[FORMULA_3]]", "formula_text": r"\\sqrt{\\delta R}"},
    ]

    discount = formula_estimate_discount(
"[[FORMULA_1]], [[FORMULA_2]] and [[FORMULA_3]] jointly decide the outcome.",
        formula_map,
    )

    assert 0.86 <= discount < 1.0


def test_dollar_inline_math_contributes_to_formula_discount() -> None:
    discount = formula_estimate_discount(
r"along $g-h(\mathbf{R}_x)$ and $\\frac{\\partial E}{\\partial R}$ path changed.",
        [],
    )

    assert 0.86 <= discount < 1.0


def test_formula_heavy_height_estimate_is_less_aggressive_than_plain_line_count() -> None:
    inner = [0.0, 0.0, 120.0, 30.0]
    formula_map = [
        {"placeholder": "[[FORMULA_1]]", "formula_text": r"x_1"},
        {"placeholder": "[[FORMULA_2]]", "formula_text": r"\\frac{\\partial E}{\\partial R}"},
        {"placeholder": "[[FORMULA_3]]", "formula_text": r"\\sqrt{\\delta R}"},
    ]
formula_text = "[[FORMULA_1]], [[FORMULA_2]] and [[FORMULA_3]] jointly decide outcome"
    plain_text = "Variable one, partial derivative energy, and square-root perturbation jointly determine the result."

    formula_height = estimated_render_height_pt(inner, formula_text, formula_map, 10.4, 0.6)
    plain_height = estimated_render_height_pt(inner, plain_text, [], 10.4, 0.6)

    assert formula_height < plain_height * 1.35
