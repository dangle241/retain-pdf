import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.collision import mark_adjacent_collision_risk


def test_body_font_unify_then_leading_refit_preserves_page_font_consistency() -> None:
    def make_payload(y0: float, y1: float, font_size: float, source_lines: int) -> dict:
        return {
            "inner_bbox": [10.0, y0, 260.0, y1],
            "translated_text": "This is a body paragraph used to test page-level font unification and secondary line spacing fitting." * 2,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for smoothing and refit",
                "bbox": [10.0, y0, 260.0, y1],
                "lines": [
                    {"bbox": [10.0, y0 + index * 12.0, 260.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    compact = make_payload(10.0, 100.0, 10.0, 5)
    loose = make_payload(120.0, 300.0, 10.6, 12)

    apply_body_payload_pipeline([compact, loose], page_text_width_med=220.0)

    assert compact["font_size_pt"] == loose["font_size_pt"]
    assert loose["leading_em"] > compact["leading_em"] + 0.2
    assert loose["leading_em"] <= 1.02


def test_body_font_unify_shrinks_large_body_fonts_to_low_page_anchor() -> None:
    def make_payload(y0: float, y1: float, font_size: float, text: str, source_lines: int) -> dict:
        return {
            "inner_bbox": [45.0, y0, 385.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.56,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for page font unification",
                "bbox": [45.0, y0, 385.0, y1],
                "lines": [
                    {"bbox": [45.0, y0 + index * 12.0, 385.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    long_a = make_payload(60.0, 116.0, 11.27, "Stable page font size for long body text." * 4, 5)
    long_b = make_payload(150.0, 212.0, 11.19, "Another long body paragraph for stabilizing page font size." * 5, 6)
    compact = make_payload(490.0, 525.0, 9.67, "Shorter but still body text. Cannot be visibly smaller on same page." * 3, 3)

    apply_body_payload_pipeline([long_a, long_b, compact], page_text_width_med=340.0)

    assert compact["font_size_pt"] <= 9.86
    assert max(payload["font_size_pt"] for payload in [long_a, long_b, compact]) / compact["font_size_pt"] < 1.08
    assert long_a["font_size_pt"] <= 10.5


def test_body_font_unify_locks_page_candidates_to_single_target() -> None:
    def make_payload(y0: float, y1: float, font_size: float, text: str, source_lines: int) -> dict:
        return {
            "inner_bbox": [45.0, y0, 385.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.56,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for page font unification",
                "bbox": [45.0, y0, 385.0, y1],
                "lines": [
                    {"bbox": [45.0, y0 + index * 12.0, 385.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    top = make_payload(60.0, 86.0, 11.17, "Top body paragraph. Simulates oversized visual font in short paragraph." * 2, 2)
    middle = make_payload(110.0, 160.0, 11.19, "Mid-body paragraph. Simulates multi-line text with oversized visual font." * 3, 4)
    low = make_payload(190.0, 226.0, 9.57, "Same-column body paragraph. Treat as unified low-font-size target." * 2, 3)

    apply_body_payload_pipeline([top, middle, low], page_text_width_med=340.0)

    fonts = {payload["font_size_pt"] for payload in (top, middle, low)}
    assert len(fonts) == 1
    assert fonts == {9.57}


def test_collision_keeps_unified_body_font_and_only_compresses_leading() -> None:
    current = {
        "inner_bbox": [45.0, 490.0, 384.0, 525.0],
        "translated_text": "Here the product function is a new Gaussian function, centered at some point, and contains multiple longer explanations." * 3,
        "formula_map": [],
        "font_size_pt": 11.17,
        "page_body_font_size_pt": 11.17,
        "leading_em": 0.72,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "adjacent_collision_risk": False,
        "item": {
            "source_text": "body text with nearby next block",
            "bbox": [45.0, 490.0, 384.0, 525.0],
            "lines": [{"bbox": [45.0, 490.0, 384.0, 502.0]}],
        },
    }
    nxt = {
        "inner_bbox": [45.0, 526.0, 384.0, 610.0],
        "translated_text": "Next body paragraph.",
        "formula_map": [],
        "font_size_pt": 11.17,
        "page_body_font_size_pt": 11.17,
        "leading_em": 0.72,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "adjacent_collision_risk": False,
        "item": {"source_text": "next body", "bbox": [45.0, 526.0, 384.0, 610.0], "lines": []},
    }

    mark_adjacent_collision_risk([current, nxt])

    assert current["font_size_pt"] == 11.17
    assert current["leading_em"] == 0.56
    assert current["prefer_typst_fit"] is False
    assert current["adjacent_collision_risk"] is False
    assert current["_body_collision_leading_only"] is True
