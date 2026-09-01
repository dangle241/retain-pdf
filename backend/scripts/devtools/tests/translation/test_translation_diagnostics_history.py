from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.diagnostics import record_translation_diagnostics


def test_top_level_merge_semantics_unchanged() -> None:
# Contract: Top level remains dictOverwrite mergeââExisting reader (frontend/Rust/debug index) Zero-knowledge.
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
    # Previously degradation_reason/fallback_to Overwritten by post-write phase; history lost.;
    # Now each stage's updates Keep all history in history.
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
    # Cover old pattern bug:"Construct snapshot. Concurrent writes occur. Overwrite entire segment."。
    # helper Re-read before write item Current diagnosis.
    item = {"translation_diagnostics": {"a": 1}}
    item["translation_diagnostics"] = {**item["translation_diagnostics"], "written_in_between": True}

    record_translation_diagnostics(item, "final_recovery", {"b": 2})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["written_in_between"] is True
    assert diagnostics["a"] == 1
    assert diagnostics["b"] == 2
