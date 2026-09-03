from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT


# Single writer gate for payload status fields.
#
# Background: the 12-stage translation pipeline shares the same mutable
# payload item dict, and historically any stage could write status fields
# directly. This caused overwrite-class bugs (e.g. the orchestration stage
# overwriting `skip_reason` written by the policy stage). This check
# freezes, per field, the set of files that are allowed to write the key:
# new code must not write these keys from outside the set. To write, call
# the owner module's helper, or update the rule here once a new owner has
# been consolidated.
#
# Annotation conventions:
# - owner        the field's semantic owner module, kept long-term
# - frozen-debt  current real writers slated for removal (delete the entry
#                here once the consolidation PR merges)
PAYLOAD_FIELD_WRITER_ALLOWLIST: dict[str, frozenset[str]] = {
    # ---- Policy decision fields: owner = core/payload/parts/policy_state.py ----
    "should_translate": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/template_sync.py",  # frozen-debt: template-sync backfill
        }
    ),
    "skip_reason": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/parts/common.py",  # frozen-debt: seed only fills in missing, never overwrites
        }
    ),
    "classification_label": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/template_sync.py",  # frozen-debt: template-sync backfill
        }
    ),
    # ---- Final status: the only assignment point on a payload item = final_status.py::set_final_status ----
    # The remaining entries are writes of the same key into the result metadata
    # dict / diagnostics dict (NOT the payload item). They belong to the
    # result pipeline and are frozen here too, to keep new files from
    # introducing writes under the same name.
    "final_status": frozenset(
        {
            "services/translation/core/payload/parts/final_status.py",  # owner: set_final_status funnel
            "services/translation/core/payload/parts/result_status.py",  # diagnostics dict
            "services/translation/core/payload/parts/apply.py",  # result metadata (neighbor-segment leak downgrade)
            "services/translation/core/payload/parts/result_entries.py",  # result metadata
            "services/translation/core/payload/template_contract.py",  # frozen-debt
            "services/translation/artifacts/io.py",  # frozen-debt: diagnostic artifact
            "services/translation/artifacts/status.py",  # frozen-debt: diagnostic artifact
            "services/translation/llm/placeholder_transform.py",  # result metadata
            "services/translation/llm/result_canonicalizer.py",  # result metadata
            "services/translation/llm/result_payload.py",  # result metadata
            "services/translation/llm/shared/orchestration/metadata.py",  # result metadata
            "services/translation/llm/shared/orchestration/sentence_level.py",  # result metadata
            "services/translation/llm/shared/orchestration/terminal_payloads.py",  # result metadata
            "services/translation/services/postprocess/garbled_reconstruction.py",  # diagnostics dict
        }
    ),
    # ---- Diagnostics: owner = core/payload/parts/diagnostics.py (top-level merge + history append) ----
    # The repair chain (garbled reconstruction / agent repair / final funnel)
    # has already migrated. The rest are result-metadata or first-write
    # diagnostic paths, frozen here to be migrated later on a per-stage
    # basis.
    "translation_diagnostics": frozenset(
        {
            "services/translation/core/payload/parts/diagnostics.py",  # owner: record_translation_diagnostics
            "services/translation/core/payload/parts/final_status.py",  # owner: violation breadcrumb
            "services/translation/core/payload/parts/apply.py",  # frozen-debt: backfill initial write
            "services/translation/core/payload/parts/result_entries.py",  # result metadata
            "services/translation/core/payload/parts/result_status.py",  # frozen-debt
            "services/translation/llm/shared/orchestration/direct_typst_long_text.py",  # result metadata
            "services/translation/llm/shared/orchestration/heavy_formula.py",  # result metadata
            "services/translation/llm/shared/orchestration/metadata.py",  # result metadata
            "services/translation/llm/shared/orchestration/sentence_level.py",  # result metadata
            "services/translation/llm/shared/orchestration/terminal_payloads.py",  # result metadata
            "services/translation/services/fast_path/keep_origin.py",  # frozen-debt
            "services/translation/services/finalization/untranslated.py",  # result payload (backfilled via apply)
            "services/translation/services/results/applier.py",  # frozen-debt
        }
    ),
    # ---- Translation text field: owner = core/payload/parts/apply.py ----
    "translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
            "services/translation/llm/shared/orchestration/metadata.py",  # result metadata
        }
    ),
    "protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
            "services/translation/core/payload/template_sync.py",  # frozen-debt: template-sync backfill
        }
    ),
    "translation_unit_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
        }
    ),
    "translation_unit_protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
        }
    ),
    "group_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/translation_units.py",  # owner: group reset
            "services/translation/core/payload/template_sync.py",  # frozen-debt: template-sync backfill
        }
    ),
    "group_protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/translation_units.py",  # owner: group reset
            "services/translation/core/payload/template_sync.py",  # frozen-debt: template-sync backfill
        }
    ),
}

_FIELD_OWNER_HINT = {
    "should_translate": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "skip_reason": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "classification_label": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "final_status": "core/payload/parts/final_status.py (set_final_status), or higher-level result_status.py mark_* helper",
    "translation_diagnostics": "core/payload/parts/diagnostics.py (record_translation_diagnostics)",
    "translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "protected_translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "translation_unit_translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "translation_unit_protected_translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "group_translated_text": "core/payload/parts/apply.py (apply_group_translated_entry)",
    "group_protected_translated_text": "core/payload/parts/apply.py (apply_group_translated_entry)",
}


def _subscript_write_keys(node: ast.AST) -> list[str]:
    keys: list[str] = []
    targets: list[ast.expr] = []
    if isinstance(node, ast.Assign):
        targets = list(node.targets)
    elif isinstance(node, (ast.AugAssign, ast.AnnAssign)):
        targets = [node.target]
    for target in targets:
        elements = target.elts if isinstance(target, (ast.Tuple, ast.List)) else [target]
        for element in elements:
            if (
                isinstance(element, ast.Subscript)
                and isinstance(element.slice, ast.Constant)
                and isinstance(element.slice.value, str)
            ):
                keys.append(element.slice.value)
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "setdefault"
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
    ):
        keys.append(node.args[0].value)
    return keys


def gated_field_writes(tree: ast.AST) -> dict[str, list[int]]:
    """Return writes to gated fields found in the AST: field -> list of line numbers."""
    writes: dict[str, list[int]] = {}
    for node in ast.walk(tree):
        for key in _subscript_write_keys(node):
            if key in PAYLOAD_FIELD_WRITER_ALLOWLIST:
                writes.setdefault(key, []).append(getattr(node, "lineno", 0))
    return writes


def check_translation_payload_field_writers(errors: list[str]) -> None:
    for path in scan_py_files(TRANSLATION_ROOT):
        rel_path = Path(rel(path)).as_posix()
        tree = parse_python_file(path)
        for field, lines in sorted(gated_field_writes(tree).items()):
            if rel_path in PAYLOAD_FIELD_WRITER_ALLOWLIST[field]:
                continue
            owner_hint = _FIELD_OWNER_HINT.get(field, "the owner module for this field")
            for line in lines:
                errors.append(
                    f"{rel_path}:{line}: direct write to payload field \"{field}\" is forbidden; "
                    f"use {owner_hint} instead, or update the rule in translation_field_writers.py once a consolidated owner is established"
                )
