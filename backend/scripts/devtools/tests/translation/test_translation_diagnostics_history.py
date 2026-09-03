from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.diagnostics import record_translation_diagnostics


def test_top_level_merge_semantics_unchanged() -> None:
    # Contract: the top level remains a dict with overwrite-merge
    # semantics — existing readers (frontend / Rust / debug index) see
    # no change.
    item = {
        "translation_diagnostics": {
            "route_path": ["batch"],
            "degradation_reason": "old",
            "untouched_key": 1,
        }
    }

    record_translation_diagnostics(item, "agent_repair", {"degradation_reason": "new"})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["degradation_reason"] == "new"
    assert diagnostics["route_path"] == ["batch"]
    assert diagnostics["untouched_key"] == 1


def test_history_preserves_per_stage_updates() -> None:
    # Previously `degradation_reason` / `fallback_to` would be overwritten
    # by later stages and the prior history was lost; now every stage's
    # `updates` is preserved in `history`.
    item: dict = {}

    record_translation_diagnostics(
        item, "garbled_reconstruction", {"degradation_reason": "garbled_reconstructed"}
    )
    record_translation_diagnostics(
        item, "final_recovery", {"degradation_reason": "blocking_untranslated_recovered"}
    )

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["degradation_reason"] == "blocking_untranslated_recovered"
    assert diagnostics["history"] == [
        {"stage": "garbled_reconstruction", "degradation_reason": "garbled_reconstructed"},
        {"stage": "final_recovery", "degradation_reason": "blocking_untranslated_recovered"},
    ]


def test_rereads_item_state_instead_of_stale_snapshot() -> None:
    # Targets the failure mode of the old pattern: "snapshot first,
    # someone else writes in between, then we rewrite the whole thing".
    # The helper must re-read the item's current diagnostics before
    # writing.
    item = {"translation_diagnostics": {"a": 1}}
    item["translation_diagnostics"] = {**item["translation_diagnostics"], "written_in_between": True}

    record_translation_diagnostics(item, "final_recovery", {"b": 2})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["written_in_between"] is True
    assert diagnostics["a"] == 1
    assert diagnostics["b"] == 2
