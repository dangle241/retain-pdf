import sys
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.font_fit import is_body_text_candidate
from services.rendering.layout.font_fit import local_font_size_pt
from services.rendering.layout.font_fit import normalize_leading_em_for_font_size
from services.rendering.layout.font_fit import BODY_LEADING_MAX
from services.rendering.layout.font_fit import BODY_LEADING_MIN
from services.rendering.layout.payload.block_seed_body_policy import is_dense_small_box
from services.rendering.layout.payload.block_seed_body_policy import is_heavy_dense_small_box
from services.rendering.layout.payload.blocks import build_render_blocks
from services.rendering.layout.payload.block_seed import _relax_wide_aspect_body_leading
from services.rendering.layout.payload.fit import fit_translated_block_metrics
from services.rendering.layout.typography.measurement import source_visual_line_count
from services.rendering.layout.typography.measurement import visual_line_count


def _sample_item(*, wide_aspect: bool) -> dict:
    return {
        "block_type": "text",
        "source_text": (
            "This document offers initial ideas for an industrial policy agenda to keep people first "
            "during the transition to superintelligence."
        ),
        "bbox": [40, 100, 512, 205],
        "lines": [
            {"bbox": [40, 100, 505, 113], "spans": [{"type": "text", "content": "This document offers initial ideas"}]},
            {"bbox": [40, 115, 503, 128], "spans": [{"type": "text", "content": "for an industrial policy agenda"}]},
            {"bbox": [40, 130, 506, 143], "spans": [{"type": "text", "content": "to keep people first during"}]},
            {"bbox": [40, 145, 504, 158], "spans": [{"type": "text", "content": "the transition to"}]},
            {"bbox": [40, 160, 500, 173], "spans": [{"type": "text", "content": "superintelligence."}]},
        ],
        "_is_body_text_candidate": True,
        "_wide_aspect_body_text": wide_aspect,
    }

class WideAspectBodyLeadingTests(unittest.TestCase):
    def test_dense_body_boxes_do_not_inherit_oversized_page_font(self):
        items = [
            {
                "item_id": "large-body",
                "block_type": "text",
                "source_text": "Large paragraph establishes the local page body size.",
                "bbox": [40, 80, 520, 230],
                "lines": [
                    {"bbox": [40, 80, 515, 96], "spans": [{"type": "text", "content": "Large paragraph"}]},
                    {"bbox": [40, 104, 515, 120], "spans": [{"type": "text", "content": "with generous geometry."}]},
                ],
                "protected_translated_text": "Set base font size. Use CSS. → skipped: inline styles, add when multiple pages require different sizes.",
            },
            {
                "item_id": "dense-small",
                "block_type": "text",
                "source_text": "Dense small paragraph should stay visually modest.",
                "bbox": [40, 250, 220, 300],
                "lines": [
                    {"bbox": [40, 250, 218, 263], "spans": [{"type": "text", "content": "Dense small paragraph"}]},
                    {"bbox": [40, 266, 218, 279], "spans": [{"type": "text", "content": "with longer translated text."}]},
                ],
                "protected_translated_text": "Text box size inherit page body font size. Adjust CSS." * 2,
            },
        ]

        blocks = build_render_blocks(items, page_width=612.0, page_height=792.0)
        dense_block = next(block for block in blocks if block.block_id == "item-1")

        self.assertLessEqual(dense_block.font_size_pt, 10.35)

    def test_wide_aspect_body_relaxes_leading_when_vertical_slack_exists(self):
        text = (
            "This document outlines a preliminary industrial policy agenda to ensure a human-centric approach during the transition to superintelligence."
            "The content is divided into two parts: first, to build an open economy with broad participation, participation, and shared prosperity;"
            "Second, build a resilient society through accountability, alignment, and frontier risk management."
        )
        relaxed = _relax_wide_aspect_body_leading(
            [82.0, 337.0, 530.0, 436.0],
            text,
            [],
            11.32,
            0.42,
        )
        self.assertGreater(relaxed, 0.42)

    def test_wide_aspect_body_keeps_leading_when_height_is_tight(self):
        text = (
            "Yet these very capabilities that drive progress will reshape entire industries at unprecedented speed and scale."
            "Some jobs will disappear, others will evolve, and as organizations learn how to deploy advanced AI,"
            "New work paradigms will emerge."
        )
        relaxed = _relax_wide_aspect_body_leading(
            [82.0, 454.0, 530.0, 493.0],
            text,
            [],
            11.32,
            0.42,
        )
        self.assertLessEqual(relaxed, 0.46)

    def test_underfilled_body_uses_font_growth_before_loose_leading(self):
        items = [
            {
                "item_id": "body-anchor",
                "block_type": "text",
                "source_text": "A normal paragraph establishes body size.",
                "bbox": [44, 80, 382, 132],
                "lines": [
                    {"bbox": [44, 80, 380, 93], "spans": [{"type": "text", "content": "A normal paragraph"}]},
                    {"bbox": [44, 96, 380, 109], "spans": [{"type": "text", "content": "establishes body size."}]},
                ],
                "protected_translated_text": "This is a normal body paragraph used to establish the body font size.",
            },
            {
                "item_id": "underfilled",
                "block_type": "text",
                "source_text": "A short translated body paragraph has ample vertical room.",
                "bbox": [44, 160, 382, 250],
                "lines": [
                    {"bbox": [44, 160, 380, 173], "spans": [{"type": "text", "content": "A short translated body paragraph"}]},
                    {"bbox": [44, 176, 380, 189], "spans": [{"type": "text", "content": "has ample vertical room."}]},
                ],
"protected_translated_text": "This is relatively short body text.",
            },
            {
                "item_id": "body-anchor-2",
                "block_type": "text",
                "source_text": "Another normal paragraph establishes body size.",
                "bbox": [44, 280, 382, 332],
                "lines": [
                    {"bbox": [44, 280, 380, 293], "spans": [{"type": "text", "content": "Another normal paragraph"}]},
                    {"bbox": [44, 296, 380, 309], "spans": [{"type": "text", "content": "establishes body size."}]},
                ],
                "protected_translated_text": "Set font size. Use CSS. → skipped: inline styles, add when multiple components require styling.",
            },
        ]

        blocks = build_render_blocks(items, page_width=430.0, page_height=655.0)
        underfilled = next(block for block in blocks if block.source_item_id == "underfilled")
        anchors = [block for block in blocks if block.source_item_id in {"body-anchor", "body-anchor-2"}]

        self.assertGreaterEqual(underfilled.font_size_pt, min(block.font_size_pt for block in anchors) - 0.2)
        self.assertLessEqual(underfilled.leading_em, 0.70)


if __name__ == "__main__":
    unittest.main()
