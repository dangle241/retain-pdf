import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.emit import payload_to_render_block
from services.rendering.output.typst.block_renderer import build_typst_block


def test_page_long_body_anchors_raise_single_line_body_font_and_allow_bbox_overflow() -> None:
    def make_payload(y0: float, y1: float, font_size: float, text: str, source_lines: int) -> dict:
        return {
            "inner_bbox": [10.0, y0, 280.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for page anchor policy",
                "bbox": [10.0, y0, 280.0, y1],
                "lines": [
                    {"bbox": [10.0, y0 + index * 12.0, 280.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    long_a = make_payload(10.0, 112.0, 10.8, "Long body paragraph. Stabilizes page font baseline." * 5, 8)
    long_b = make_payload(130.0, 232.0, 10.9, "Another longer body paragraph to stabilize the page font baseline." * 5, 8)
    short = make_payload(248.0, 262.0, 9.4, "Short body text should inherit page font.", 1)

    apply_body_payload_pipeline([long_a, long_b, short], page_text_width_med=240.0)

    assert short["font_size_pt"] == long_a["font_size_pt"] == long_b["font_size_pt"]
    assert short["_short_body_font_inherited"] is True
    assert short["_allow_short_text_bbox_overflow"] is True
    assert short["prefer_typst_fit"] is False


def test_short_body_bbox_overflow_marker_disables_typst_fit() -> None:
    payload = {
        "index": 1,
        "item": {
            "item_id": "p001-b002",
            "bbox": [10.0, 248.0, 280.0, 262.0],
            "lines": [{"bbox": [10.0, 248.0, 280.0, 260.0]}],
            "source_text": "short body text",
        },
        "bbox": [10.0, 248.0, 280.0, 262.0],
        "cover_bbox": [10.0, 248.0, 280.0, 262.0],
        "inner_bbox": [10.0, 248.0, 280.0, 262.0],
        "translated_text": "Short text inherit page font. → skipped: additional styling, add when custom font needed.",
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 10.8,
        "leading_em": 0.56,
        "first_line_indent_pt": 0.0,
        "font_weight": "regular",
        "page_body_font_size_pt": 10.8,
        "is_body": True,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "prefer_typst_fit": False,
        "title_fit": None,
        "preserve_line_breaks": False,
        "adjacent_collision_risk": False,
        "adjacent_available_height_pt": None,
        "_allow_short_text_bbox_overflow": True,
    }

    block = payload_to_render_block(payload)

    assert block.font_size_pt == 10.8
    assert block.fit_to_box is False


def test_short_body_inline_formula_overflow_keeps_font_and_formula_padding() -> None:
    payload = {
        "index": 1,
        "item": {
            "item_id": "p001-b002",
            "bbox": [10.0, 248.0, 280.0, 262.0],
            "lines": [{"bbox": [10.0, 248.0, 280.0, 260.0]}],
            "source_text": "short body text with inline formula",
        },
        "bbox": [10.0, 248.0, 280.0, 262.0],
        "cover_bbox": [10.0, 248.0, 280.0, 262.0],
        "inner_bbox": [10.0, 248.0, 280.0, 262.0],
"translated_text": "where $c_{\\kappa}$ Linear coefficients.",
        "formula_map": [{"placeholder": "<f0-abc/>", "formula_text": "c_{\\kappa}"}],
        "render_kind": "markdown",
        "font_size_pt": 10.8,
        "leading_em": 0.56,
        "first_line_indent_pt": 0.0,
        "font_weight": "regular",
        "page_body_font_size_pt": 10.8,
        "is_body": True,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "prefer_typst_fit": False,
        "title_fit": None,
        "preserve_line_breaks": False,
        "adjacent_collision_risk": False,
        "adjacent_available_height_pt": None,
        "_allow_short_text_bbox_overflow": True,
    }

    block = payload_to_render_block(payload)
    typst = build_typst_block("item-p001-b002", block)

    assert block.font_size_pt == 10.8
    assert block.fit_to_box is False
    assert "pdftr_fit_markdown" not in typst
    assert "pad(top:" in typst


def test_body_font_unify_includes_short_dense_body_without_typst_fit() -> None:
    def make_payload(
        y0: float,
        y1: float,
        font_size: float,
        text: str,
        *,
        dense: bool = False,
        heavy: bool = False,
        prefer_fit: bool = False,
    ) -> dict:
        return {
            "inner_bbox": [45.0, y0, 385.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.56,
            "dense_small_box": dense,
            "heavy_dense_small_box": heavy,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": prefer_fit,
            "item": {
                "source_text": "body text",
                "bbox": [45.0, y0, 385.0, y1],
                "lines": [{"bbox": [45.0, y0, 385.0, y0 + 10.0]}],
            },
        }

anchor_a = make_payload(60.0, 112.0, 11.17, "This is a long body paragraph with stable page font size." * 4)
anchor_b = make_payload(132.0, 190.0, 11.17, "This is another long body paragraph with stable page font size." * 4)
    short_dense = make_payload(
        210.0,
        223.0,
        10.2,
        "Here, variable. r Measured from the Gaussian sphere origin.",
        dense=True,
        heavy=True,
        prefer_fit=True,
    )

    apply_body_payload_pipeline([anchor_a, anchor_b, short_dense], page_text_width_med=340.0)

    assert short_dense["font_size_pt"] == anchor_a["font_size_pt"] == anchor_b["font_size_pt"]
    assert short_dense["prefer_typst_fit"] is False
    assert short_dense["_body_font_unified"] is True


def test_unified_body_font_still_uses_typst_fit_when_estimated_overflow() -> None:
    payload = {
        "index": "p024-b007",
        "item": {
            "item_id": "p024-b007",
            "bbox": [33.482, 541.747, 398.284, 613.214],
            "lines": [{"bbox": [33.482, 541.747, 398.284, 553.0]}],
            "protected_translated_text": "The wave function found is not normalized. Normalization constant given by(3.93)is given."
            "Integral approximation, summation approximation, multiple cell formulas. Text long enough to simulate overflow after uniform font size."
            * 6,
        },
        "bbox": [33.482, 541.747, 398.284, 613.214],
        "cover_bbox": [33.482, 541.747, 398.284, 613.214],
        "inner_bbox": [33.482, 542.819, 398.284, 612.142],
"translated_text": "The wave function we found is not yet normalized. The normalization constant is given by Eq. (3.93)."
"We have integral approximation, summation approximation, and multiple cell formulas; the text is long enough to simulate overflow after unifying font size."
        * 6,
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 10.35,
        "leading_em": 0.56,
        "first_line_indent_pt": 18.0,
        "font_weight": "regular",
        "page_body_font_size_pt": 10.35,
        "is_body": True,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "prefer_typst_fit": False,
        "title_fit": None,
        "adjacent_collision_risk": False,
        "adjacent_available_height_pt": None,
        "_body_font_unified": True,
    }

    block = payload_to_render_block(payload)

    assert block.fit_to_box is True
    assert block.fit_max_height_pt <= 70.0
    assert block.fit_min_font_size_pt < block.font_size_pt
