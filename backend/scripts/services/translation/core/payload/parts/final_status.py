from __future__ import annotations


# Single assignment funnel for `final_status` on a payload item.
#
# Status semantics:
# - ""                     Not yet finalized (pending)
# - "translated"           Translation produced
# - "partially_translated" Translation was salvaged by a degraded cleanup
#                          pass (reasoning-leak salvage, neighbor-continuation
#                          leak trimming, etc.)
# - "failed"               Translation failed, awaiting the repair chain
# - "kept_origin"          Source text kept per policy
#
# The only transition that is explicitly forbidden: a successful translation
# must never be downgraded to `failed`. The repair chain (garbled
# reconstruction / agent repair / final funnel) is only allowed to pull
# `failed` items back to success; the reverse direction is a violation.
#
# v1 is observe-only: violations still write through, but leave a
# breadcrumb under `translation_diagnostics.final_status_violations`. Once
# real jobs show the violations no longer occur (or are confirmed bugs
# and fixed), this will be promoted to a hard block.

PENDING_STATUS = ""
TRANSLATED_STATUS = "translated"
PARTIALLY_TRANSLATED_STATUS = "partially_translated"
FAILED_STATUS = "failed"
KEPT_ORIGIN_STATUS = "kept_origin"

KNOWN_FINAL_STATUSES = frozenset(
    {
        PENDING_STATUS,
        TRANSLATED_STATUS,
        PARTIALLY_TRANSLATED_STATUS,
        FAILED_STATUS,
        KEPT_ORIGIN_STATUS,
    }
)

_FORBIDDEN_TRANSITIONS = frozenset(
    {
        (TRANSLATED_STATUS, FAILED_STATUS),
        (PARTIALLY_TRANSLATED_STATUS, FAILED_STATUS),
    }
)


def final_status_violation(previous: str, next_status: str) -> str:
    if next_status not in KNOWN_FINAL_STATUSES:
        return f"unknown_status:{next_status}"
    if (previous, next_status) in _FORBIDDEN_TRANSITIONS:
        return f"demotion:{previous}->{next_status}"
    return ""


def set_final_status(item: dict, status: str) -> None:
    previous = str(item.get("final_status", "") or "")
    next_status = str(status or "")
    violation = final_status_violation(previous, next_status)
    if violation:
        diagnostics = dict(item.get("translation_diagnostics") or {})
        violations = list(diagnostics.get("final_status_violations") or [])
        violations.append(violation)
        diagnostics["final_status_violations"] = violations
        item["translation_diagnostics"] = diagnostics
    item["final_status"] = next_status


__all__ = [
    "FAILED_STATUS",
    "KEPT_ORIGIN_STATUS",
    "KNOWN_FINAL_STATUSES",
    "PARTIALLY_TRANSLATED_STATUS",
    "PENDING_STATUS",
    "TRANSLATED_STATUS",
    "final_status_violation",
    "set_final_status",
]
