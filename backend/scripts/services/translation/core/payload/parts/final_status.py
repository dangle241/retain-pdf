from __future__ import annotations


# payload item on final_status the only assignment funnel for.
#
# State semantics:
# - ""                    Not finalized(pending)
# - "translated"          Translation output generated.
# - "partially_translated": translation cleaned via downgrade (reasoning leak salvage, adjacent segment leakage clipping, etc.)
# - "failed"              Translation failed,Await fix chain fallback
# - "kept_origin"         Keep original per policy
#
# The only transfer explicitly prohibited:Successful translations must not be downgraded to failed。
# Fix chain (garbled reconstruction/agent repair/final closure) only allows failed to be pulled to succeeded; reverse is violation.
#
# v1 Monitor Only:violations are still written as usual,But at translation_diagnostics.final_status_violations
# Leave breadcrumbs. Wait for real tasks to prove violations no longer occur (or confirm ownership bug) then upgrade to hard block.

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
