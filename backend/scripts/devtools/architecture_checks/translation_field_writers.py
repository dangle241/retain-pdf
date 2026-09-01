from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT


# payload Status field uniqueness writer Access control.
#
# Background:12 Step translation pipeline shares same mutable batch payload item dict,Any historical stage can
# Write status field directly,Causes class override. bug(Override during orchestration phase policy Written skip_reason)。
# Check freezes existing per field. writer File collection:New code must not write these outside the collection. key,
# Call to write. owner Module's helper,Or initialize new post-convergence here first. owner Update rules.
#
# Annotation convention:
# - owner        Module consolidating field semantics.,Keep indefinitely.
# - frozen-debt  Current write points, targeted for gradual removal(Converge PR Delete here after completion.)
PAYLOAD_FIELD_WRITER_ALLOWLIST: dict[str, frozenset[str]] = {
    # ---- policy Decision field:owner = core/payload/parts/policy_state.py ----
    "should_translate": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/template_sync.py",  # frozen-debt: Template sync backfill
        }
    ),
    "skip_reason": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/parts/common.py",  # frozen-debt: seed Missing input. Provide source text for translation.(Append only.)
        }
    ),
    "classification_label": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
"services/translation/core/payload/template_sync.py",  # frozen-debt: template sync backfill
        }
    ),
    # ---- Final state:payload item Sole assignment point above. = final_status.py::set_final_status ----
    # Remaining entries are result metadata dict / diagnostics dict same name key Write(non- payload item),
    # Result chain.;Freeze all,Prevent new files from reintroducing same-name writes.
    "final_status": frozenset(
        {
            "services/translation/core/payload/parts/final_status.py",  # owner: set_final_status funnel
            "services/translation/core/payload/parts/result_status.py",  # diagnostics dict
            "services/translation/core/payload/parts/apply.py",  # result metadata(Adjacent segment leak degradation)
            "services/translation/core/payload/parts/result_entries.py",  # result metadata
            "services/translation/core/payload/template_contract.py",  # frozen-debt
            "services/translation/artifacts/io.py",  # frozen-debt: diagnostic artifacts
            "services/translation/artifacts/status.py",  # frozen-debt: diagnostic artifacts
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
    # Fix chain(Rebuild garbled text/agent repair/Final closure)Migrated;The rest are result metadata /
    # Path for initial diagnostic generation,Frozen pending subsequent processing. stage gradual identity migration.
    "translation_diagnostics": frozenset(
        {
            "services/translation/core/payload/parts/diagnostics.py",  # owner: record_translation_diagnostics
            "services/translation/core/payload/parts/final_status.py",  # owner: violation breadcrumbs
            "services/translation/core/payload/parts/apply.py",  # frozen-debt: Backfill initial write.
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
    # ---- translated text segment:owner = core/payload/parts/apply.py ----
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
"services/translation/core/payload/template_sync.py",  # frozen-debt: template sync backfill
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
            "services/translation/core/payload/parts/translation_units.py",  # owner: Grouping reset
"services/translation/core/payload/template_sync.py",  # frozen-debt: template sync backfill
        }
    ),
    "group_protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
"services/translation/core/payload/parts/translation_units.py",  # owner: grouping reset
"services/translation/core/payload/template_sync.py",  # frozen-debt: template sync backfill
        }
    ),
}

_FIELD_OWNER_HINT = {
    "should_translate": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "skip_reason": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "classification_label": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "final_status": "core/payload/parts/final_status.py (set_final_status),or higher result_status.py mark_* helper",
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
"""Return AST access-control writes to restricted field: field -> line number list."""
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
owner_hint = _FIELD_OWNER_HINT.get(field, "of this field's owner module")
            for line in lines:
                errors.append(
f"{rel_path}:{line}: Forbid directly writing payload field \"{field}\"; "
                    f"Please use instead {owner_hint}, or translation_field_writers.py converged owner update rules"
                )
