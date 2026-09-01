from __future__ import annotations


# translation_diagnostics Unified write entry point(Dedicated to fix chain.,Gradual rollout)。
#
# Contract:
# - Keep top-level dict, overwrite merge, fully compatible with existing readers (frontend debug panel, Rust views,
#   debug index、replay Tools)Fully compatible;
# - Write each time, include current updates append to diagnostics["history"],
#   Keep processing traces for all stages——previously route_path/degradation_reason/fallback_to
#   Wait for single-value field to be overwritten by subsequent stage.,History lost.;
# - Re-read before write. item Current on diagnostics,Avoid"Construct snapshot first; intermediate others.
#   Write, then rewrite entire paragraph."Silent overwrite caused.


def record_translation_diagnostics(item: dict, stage: str, updates: dict) -> dict:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    diagnostics.update(updates)
    history = list(diagnostics.get("history") or [])
    history.append({"stage": str(stage or ""), **updates})
    diagnostics["history"] = history
    item["translation_diagnostics"] = diagnostics
    return diagnostics


__all__ = ["record_translation_diagnostics"]
