from __future__ import annotations

from pathlib import Path

from devtools.architecture_checks.common import imported_modules
from devtools.architecture_checks.common import module_allowed
from devtools.architecture_checks.common import read_text
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.providers import MINERU_ROOT
from devtools.architecture_checks.providers import OCR_PROVIDER_ROOT
from devtools.architecture_checks.translation_rules import DEVTOOLS_ROOT
from devtools.architecture_checks.translation_rules import DEVTOOLS_TRANSLATION_INTERNAL_DIR_ALLOWLIST
from devtools.architecture_checks.translation_rules import DEVTOOLS_TRANSLATION_INTERNAL_IMPORT_ALLOWLIST
from devtools.architecture_checks.translation_rules import DOCUMENT_SCHEMA_ROOT
from devtools.architecture_checks.translation_rules import FROM_OCR_ENTRYPOINT
from devtools.architecture_checks.translation_rules import PIPELINE_ROOT
from devtools.architecture_checks.translation_rules import RENDERING_ROOT
from devtools.architecture_checks.translation_rules import TRANSLATE_ONLY_ENTRYPOINT
from devtools.architecture_checks.translation_rules import TRANSLATION_RENDERING_IMPORT_EXCEPTIONS
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT
from devtools.architecture_checks.translation_rules import TRANSLATION_STAGE_PIPELINE


def check_translation_worker_protocol(errors: list[str]) -> None:
    translate_only_text = read_text(TRANSLATE_ONLY_ENTRYPOINT)
    if "PipelineEventWriter(" not in translate_only_text:
        errors.append(
            "services/translation/entrypoints/translate_only_pipeline.py: worker translate-only phải khởi tạo PipelineEventWriter"
        )
    if "STDOUT_LABEL_EVENTS_JSONL" not in translate_only_text:
        errors.append(
            "services/translation/entrypoints/translate_only_pipeline.py: worker translate-only phải xuất pipeline_events.jsonl qua stdout contract"
        )
    if 'artifact_key="pipeline_events_jsonl"' not in translate_only_text:
        errors.append(
            "services/translation/entrypoints/translate_only_pipeline.py: worker translate-only phải xuất artifact pipeline_events_jsonl"
        )
    if 'artifact_key="translation_diagnostics_json"' not in translate_only_text:
        errors.append(
            "services/translation/entrypoints/translate_only_pipeline.py: worker translate-only phải xuất artifact translation_diagnostics_json"
        )
    if '"translation_diagnostics.json"' not in translate_only_text:
        errors.append(
            "services/translation/entrypoints/translate_only_pipeline.py: worker translate-only phải giữ translation_diagnostics.json làm đầu ra chẩn đoán ổn định"
        )

    from_ocr_text = read_text(FROM_OCR_ENTRYPOINT)
    if "PipelineEventWriter(" not in from_ocr_text:
        errors.append(
            "services/translation/entrypoints/from_ocr_pipeline.py: worker translate-from-ocr phải khởi tạo PipelineEventWriter"
        )
    if "STDOUT_LABEL_EVENTS_JSONL" not in from_ocr_text:
        errors.append(
            "services/translation/entrypoints/from_ocr_pipeline.py: worker translate-from-ocr phải xuất pipeline_events.jsonl qua stdout contract"
        )
    if 'artifact_key="pipeline_events_jsonl"' not in from_ocr_text:
        errors.append(
            "services/translation/entrypoints/from_ocr_pipeline.py: worker translate-from-ocr phải xuất artifact pipeline_events_jsonl"
        )


def check_translation_pipeline_facade_boundary(errors: list[str]) -> None:
    text = read_text(TRANSLATION_STAGE_PIPELINE)
    required = (
        "from services.translation.public import TranslationExecutionRequest",
        "from services.translation.public import execute_translation_request",
    )
    for item in required:
        if item not in text:
            errors.append(
                f"runtime/pipeline/translation_stage.py: phải gọi facade public dịch qua '{item}'"
            )
    forbidden = (
        "from services.translation.workflow import",
        "from services.translation.services.policy import",
        "from services.translation.services.context.session_context import",
        "from services.translation.artifacts import",
        "from services.translation.core import",
        "from services.translation.llm import",
        "from runtime.pipeline.book_translation_flow import",
    )
    for item in forbidden:
        if item in text:
            errors.append(
                f"runtime/pipeline/translation_stage.py: không được import nội bộ workflow trực tiếp: '{item}'"
            )


def check_translation_public_surface_usage(errors: list[str]) -> None:
    guarded_roots = (
        PIPELINE_ROOT,
        OCR_PROVIDER_ROOT,
        MINERU_ROOT,
        DOCUMENT_SCHEMA_ROOT,
        RENDERING_ROOT,
    )
    allowed_prefixes = (
        "services.translation.public",
        "services.translation.entrypoints",
    )
    forbidden_prefixes = (
        "services.translation.artifacts",
        "services.translation.core",
        "services.translation.llm",
        "services.translation.services",
        "services.translation.workflow",
    )
    for root in guarded_roots:
        for path in scan_py_files(root):
            for module in imported_modules(path):
                if module_allowed(module, allowed_prefixes):
                    continue
                if module_allowed(module, forbidden_prefixes):
                    errors.append(
                        f"{rel(path)}: mã sản xuất ngoài dịch phải import contract dịch qua services.translation.public, không phải '{module}'"
                    )
                    break


def check_devtools_translation_internal_usage(errors: list[str]) -> None:
    forbidden_prefixes = (
        "services.translation.artifacts",
        "services.translation.core",
        "services.translation.llm",
        "services.translation.services",
        "services.translation.workflow",
    )
    for path in scan_py_files(DEVTOOLS_ROOT):
        rel_path = path.relative_to(DEVTOOLS_ROOT)
        if rel_path.parts and rel_path.parts[0] in DEVTOOLS_TRANSLATION_INTERNAL_DIR_ALLOWLIST:
            continue
        if path == Path(__file__).resolve():
            continue
        uses_translation_internal = any(
            module_allowed(module, forbidden_prefixes)
            for module in imported_modules(path)
        )
        if not uses_translation_internal:
            continue
        if rel_path in DEVTOOLS_TRANSLATION_INTERNAL_IMPORT_ALLOWLIST:
            continue
        errors.append(
            f"{rel(path)}: script devtools import nội bộ dịch; thêm vào DEVTOOLS_TRANSLATION_INTERNAL_IMPORT_ALLOWLIST hoặc dùng services.translation.public"
        )


def check_translation_rendering_separation(errors: list[str]) -> None:
    for path in scan_py_files(TRANSLATION_ROOT):
        exception_prefixes = TRANSLATION_RENDERING_IMPORT_EXCEPTIONS.get(path.relative_to(TRANSLATION_ROOT), ())
        for module in imported_modules(path):
            if not module.startswith("services.rendering"):
                continue
            if module_allowed(module, exception_prefixes):
                continue
            errors.append(
                f"{rel(path)}: lớp dịch không được import dịch vụ rendering trực tiếp: '{module}'"
            )
            break
