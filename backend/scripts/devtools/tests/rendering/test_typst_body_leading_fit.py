import sys
import tempfile
from pathlib import Path
from unittest import mock
import re

import fitz
import pytest
from PIL import Image


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.source.background.stage import build_clean_background_pdf
from foundation.config import fonts
from services.rendering.layout.payload.blocks import build_render_blocks
from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.collision import mark_adjacent_collision_risk
from services.rendering.layout.payload.emit import payload_to_render_block
from services.rendering.layout.payload.first_line_indent import detect_first_line_indent_pt
from services.rendering.layout.payload.line_structure import maybe_preserve_structured_line_breaks
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.layout.page_specs import build_render_page_specs
from services.rendering.layout.payload.continuation_split import split_protected_text_for_boxes
from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page
from services.rendering.source.items import get_item_translated_text
from services.rendering.source.dev_overlay.text_draw import _build_direct_draw_tokens
from services.rendering.source.dev_overlay.text_draw import _fit_segment_layout
from services.rendering.layout.payload.suspicious_ocr import detect_and_drop_suspicious_ocr_glued_blocks
from services.rendering.output.typst.book_renderer import _compile_render_pages_pdf_resilient
from services.rendering.output.typst.block_renderer import build_typst_block
from services.rendering.output.typst.overlay_ops import overlay_translated_pages_on_doc
from services.rendering.output.typst.book_support import prepare_translated_pages_for_render
from services.rendering.output.typst.compiler import _resolved_font_paths
from services.rendering.output.typst.compiler import _resolved_common_root
from services.rendering.output.typst.compiler import TypstCompileError
from services.rendering.output.typst.compiler import compile_typst_book_background_pdf
from services.rendering.output.typst.compiler import compile_typst_overlay_pdf
from services.rendering.output.typst.compiler import compile_typst_render_pages_pdf
from services.rendering.output.typst.emitter import build_typst_source_from_page_specs
from services.rendering.output.typst.source_builder import build_typst_overlay_source
from services.rendering.policy import apply_render_page_policy_fields
from services.rendering.policy import build_render_page_policy
from services.rendering.policy import formula_neighbor_text_item_ids
from services.rendering.policy import item_render_policy
from services.rendering.policy import item_render_policy_reason
from services.rendering.policy import item_requires_visual_cover_only
from services.rendering.policy import item_uses_white_overlay_fill
from services.rendering.policy import protect_formula_regions_in_redaction_items
from services.rendering.output.typst.source_page_overlay import apply_source_page_overlay
from services.rendering.output.typst.overlay_diagnostics import apply_redaction_diagnostics
from services.rendering.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from services.rendering.source.background.redaction_items import redaction_items_from_layout_blocks
from services.rendering.source.cleanup.item_rects import cover_rects_from_valid_items
from services.rendering.output.typst.source_page_overlay import overlay_pages_from_single_pdf
from services.rendering.output.typst.source_page_overlay import redaction_items_from_render_blocks
from services.rendering.output.typst.sanitize import sanitize_items_for_typst_compile
from services.rendering.output.typst.overlay_ops import _extract_failed_overlay_indices
from services.rendering.output.typst.overlay_ops import _can_use_pikepdf_book_overlay
from services.rendering.workflow.cover_fallback import cover_fallback_page_indices
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.workflow.modes import _compress_final_pdf_if_needed
from services.rendering.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from services.rendering.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from services.rendering.document.pikepdf_pages import extract_pages_with_pikepdf
from services.rendering.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from devtools.tests.rendering_support.page_specs import sample_page_spec as _page_spec


def test_typst_overlay_text_blocks_use_fit_without_clipping() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [10.0, 20.0, 120.0, 42.0],
            "translated_text": "Text too long. Trim. Ensure fits. OCR Box covers content below.",
"protected_translated_text": "This is a long text to confirm that rendering does not overflow the OCR box and cover content below.",
            "formula_map": [],
        }
    ]

    source = build_typst_overlay_source(200.0, 300.0, translated_items, include_cover_rect=True)

    assert "clip: true" not in source
    assert "pdftr_fit_markdown" in source
    assert "emergency_min_size = calc.max(4.2pt" in source
    assert "emergency_min_leading = calc.max(0.20em" in source
    assert "pdftr_fit_leading" in source


def test_dense_body_pressure_tightening_does_not_increase_leading() -> None:
    normal_payload = {
        "inner_bbox": [10.0, 60.0, 210.0, 150.0],
        "translated_text": "This is a normal body block with low density.",
        "formula_map": [],
        "font_size_pt": 10.0,
        "leading_em": 0.62,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with enough words for smoothing"},
    }
    payload = {
        "inner_bbox": [10.0, 10.0, 110.0, 52.0],
        "translated_text": "Text block dense. Translation too long. Tighten. Not increase line spacing." * 4,
        "formula_map": [],
        "font_size_pt": 10.0,
        "leading_em": 0.62,
        "dense_small_box": True,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "dense body text with enough words for smoothing"},
    }
    baseline_leading = payload["leading_em"]

    apply_body_payload_pipeline([normal_payload, payload], page_text_width_med=100.0)

    assert payload["leading_em"] <= baseline_leading
    assert payload["prefer_typst_fit"] is True


def test_normal_body_leading_recovers_when_vertical_slack_exists() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 250.0, 145.0],
        "translated_text": "This is a normal body paragraph, not too crowded, and should maintain a comfortable line spacing.",
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with enough words for smoothing"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=180.0)

    assert payload["leading_em"] >= 0.56


def test_underfilled_body_density_recovery_has_floor_and_safe_target() -> None:
    from services.rendering.layout.payload.body_common import payload_density

    def make_payload(height: float) -> dict:
        return {
            "inner_bbox": [10.0, 0.0, 260.0, height],
            "translated_text": "Normal body paragraph for testing lower density limit recovery." * 2,
            "formula_map": [],
            "font_size_pt": 10.2,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "normal body words enough",
                "lines": [{"bbox": [10.0, index * 10.0, 260.0, index * 10.0 + 8.0]} for index in range(4)],
            },
        }

    already_ok = make_payload(50.0)
    recoverable = make_payload(55.0)
    too_tall = make_payload(140.0)

    before_ok = (already_ok["font_size_pt"], already_ok["leading_em"], payload_density(already_ok))
    before_recoverable_density = payload_density(recoverable)
    before_tall_density = payload_density(too_tall)

    apply_body_payload_pipeline([already_ok, recoverable, too_tall], page_text_width_med=220.0)

    assert before_ok[2] >= 0.60
    assert (already_ok["font_size_pt"], already_ok["leading_em"]) == before_ok[:2]
    assert before_recoverable_density < 0.60
    assert payload_density(recoverable) >= 0.60
    assert payload_density(recoverable) < 1.0
    assert before_tall_density < 0.60
    assert before_tall_density < payload_density(too_tall) < 1.0


def test_normal_body_leading_uses_more_slack_when_available() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 300.0, 220.0],
        "translated_text": "Increase line height. Improve readability. Test layout.",
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {
            "source_text": "normal body text with loose source leading",
            "lines": [
                {"bbox": [10.0, 10.0, 290.0, 22.0]},
                {"bbox": [10.0, 28.0, 290.0, 40.0]},
                {"bbox": [10.0, 46.0, 290.0, 58.0]},
            ],
            "bbox": [10.0, 10.0, 300.0, 70.0],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=180.0)

    assert 0.58 <= payload["leading_em"] <= 0.74


def test_normal_body_leading_stays_bounded_when_height_is_tight() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 145.0, 54.0],
        "translated_text": "Line spacing adjust. Ensure within box." * 2,
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with constrained height"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=120.0)

    assert payload["leading_em"] < 0.62


def test_normal_body_leading_spends_available_line_space() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 230.0, 86.0],
        "translated_text": "CSS line-height increase → skipped: dynamic adjustment, add when needed.",
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with enough geometry"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=160.0)

    assert 0.58 <= payload["leading_em"] <= 0.70


def test_long_normal_body_leading_can_use_high_dynamic_cap() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 250.0, 245.0],
        "translated_text": "Increase line height. Enhance readability. Adjust CSS." * 8,
        "formula_map": [],
        "font_size_pt": 9.7,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "long normal body text with generous paragraph box"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=180.0)

    assert 0.54 <= payload["leading_em"] <= 0.76


def test_source_line_rich_body_grows_font_before_expanding_chinese_leading() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 485.0, 223.0],
        "translated_text": "Adjust CSS line-height. Increase padding. Test visually." * 3,
        "formula_map": [],
        "font_size_pt": 10.3,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {
            "source_text": "source line rich paragraph",
            "bbox": [10.0, 10.0, 485.0, 223.0],
            "lines": [
                {"bbox": [10.0, 10.0 + index * 11.8, 485.0, 20.0 + index * 11.8]}
                for index in range(18)
            ],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=420.0)

    assert payload["font_size_pt"] > 10.7
    assert payload["leading_em"] <= 1.38


def test_extreme_source_line_underfill_can_expand_body_leading_after_font_growth() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 285.0, 232.0],
        "translated_text": "This is a paragraph where the Chinese translation has significantly fewer lines than the English original, requiring larger line spacing to fill the original loose layout." * 2,
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {
            "source_text": "extremely loose source line rich paragraph",
            "bbox": [10.0, 10.0, 285.0, 232.0],
            "lines": [
                {"bbox": [10.0, 10.0 + index * 13.0, 285.0, 20.0 + index * 13.0]}
                for index in range(17)
            ],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=240.0)

    assert payload["font_size_pt"] > 10.8
    assert payload["leading_em"] >= 0.9


def test_source_line_rich_body_font_growth_survives_adjacent_smoothing() -> None:
    def make_payload(y0: float, y1: float) -> dict:
        return {
            "inner_bbox": [10.0, y0, 485.0, y1],
"translated_text": "This Chinese translation only needs about six lines, but the English original has many lines, so the Chinese line spacing needs to be significantly enlarged to match the original box height." * 3,
            "formula_map": [],
            "font_size_pt": 10.3,
            "leading_em": 0.56,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "source line rich paragraph with enough words for adjacent smoothing",
                "bbox": [10.0, y0, 485.0, y1],
                "lines": [
                    {"bbox": [10.0, y0 + index * 11.8, 485.0, y0 + 10.0 + index * 11.8]}
                    for index in range(18)
                ],
            },
        }

    first = make_payload(10.0, 223.0)
    second = make_payload(240.0, 453.0)

    apply_body_payload_pipeline([first, second], page_text_width_med=420.0)

    assert first["font_size_pt"] > 10.7
    assert second["font_size_pt"] > 10.7
    assert first["leading_em"] <= 1.38
    assert second["leading_em"] <= 1.38


def test_font_growth_pairs_with_body_leading_growth() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 300.0, 235.0],
        "translated_text": "This is a body paragraph where the font size has significantly increased; line spacing also needs to increase proportionally, otherwise it will look visually cramped." * 3,
        "formula_map": [],
        "font_size_pt": 11.3,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "_body_font_growth_decision": {
            "seed_font_pt": 10.0,
            "target_font_pt": 11.3,
            "grew_pt": 1.3,
            "slack_ratio": 0.8,
            "reason": "underfilled_body",
        },
        "item": {
            "source_text": "body text with visible font growth and enough vertical slack",
            "bbox": [10.0, 10.0, 300.0, 235.0],
            "lines": [
                {"bbox": [10.0, 10.0 + index * 13.0, 300.0, 20.0 + index * 13.0]}
                for index in range(12)
            ],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=250.0)

    assert payload["font_size_pt"] >= 11.2
    assert payload["leading_em"] >= 0.58
    assert payload["leading_em"] > 0.56


