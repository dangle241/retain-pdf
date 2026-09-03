from __future__ import annotations


# Single write entry point for `translation_diagnostics` (currently used by
# the repair chain; rollout to other stages is incremental).
#
# Contract:
# - The top level remains a dict and is merged with overwrite semantics, so
#   every existing reader (frontend debug panel, Rust view, debug index,
#   replay tool) stays fully compatible.
# - Every write also appends the current `updates` into
#   `diagnostics["history"]`, preserving each stage's processing trail.
#   Previously single-value fields like `route_path`, `degradation_reason`,
#   and `fallback_to` were overwritten by later stages and the prior
#   history was lost.
# - Before writing we re-read the current diagnostics on the item to avoid
#   silent overwrites caused by the "snapshot first, then someone else
#   writes, then we rewrite the whole thing" pattern.


def record_translation_diagnostics(item: dict, stage: str, updates: dict) -> dict:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    diagnostics.update(updates)
    history = list(diagnostics.get("history") or [])
    history.append({"stage": str(stage or ""), **updates})
    diagnostics["history"] = history
    item["translation_diagnostics"] = diagnostics
    return diagnostics


__all__ = ["record_translation_diagnostics"]
