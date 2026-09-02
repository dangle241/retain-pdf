from __future__ import annotations

from services.translation.core.payload.parts.common import clear_singleton_continuation_group
from services.translation.core.payload.parts.common import seed_orchestration_metadata
from services.translation.core.payload.parts.translation_units import refresh_payload_translation_units


def finalize_payload_orchestration_metadata(payload: list[dict]) -> None:
    group_counts: dict[str, int] = {}
    for item in payload:
        group_id = str(item.get("continuation_group", "") or "").strip()
        if group_id:
            group_counts[group_id] = group_counts.get(group_id, 0) + 1

    for item in payload:
        clear_singleton_continuation_group(item, group_counts=group_counts)
        seed_orchestration_metadata(item)
    refresh_payload_translation_units(payload)


def finalize_orchestration_metadata_by_page(page_payloads: dict[int, list[dict]]) -> None:
    # Must be executed once across the whole document in flat form, matching
    # the scope used by `save_pages`'s refresh. When run per page, cross-page
    # continuation groups have only one member in each page:
    # - groups that were stitched together by review (candidate ids cleared,
    #   no provider id) get dropped as orphans by
    #   `clear_singleton_continuation_group`;
    # - provider-side cross-page groups keep their group id but their `unit`
    #   field is downgraded to `single`, contradicting the flat grouping
    #   that `save_pages` will compute afterwards.
    flat_payload = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    finalize_payload_orchestration_metadata(flat_payload)


__all__ = [
    "finalize_payload_orchestration_metadata",
    "finalize_orchestration_metadata_by_page",
]
