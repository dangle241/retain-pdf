from __future__ import annotations

import json
import re
import sys
import traceback
from dataclasses import asdict
from dataclasses import dataclass
from typing import Any


STRUCTURED_FAILURE_LABEL = "structured failure json"


@dataclass
class StructuredFailure:
    failed_stage: str
    failure_code: str
    failure_category: str
    provider_stage: str
    provider_code: str
    suggestion: str
    raw_excerpt: str
    stage: str
    error_type: str
    summary: str
    detail: str
    retryable: bool
    upstream_host: str
    provider: str
    raw_exception_type: str
    raw_exception_message: str
    traceback: str

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, separators=(",", ":"))


def _extract_upstream_host(text: str) -> str:
    for marker in ("host='", 'host="', "https://", "http://"):
        start = text.find(marker)
        if start == -1:
            continue
        rest = text[start + len(marker) :]
        host_chars: list[str] = []
        for char in rest:
            if char.isalnum() or char in ".-":
                host_chars.append(char)
                continue
            break
        host = "".join(host_chars).strip()
        if host:
            return host
    return ""


def infer_failure_stage(*, default_stage: str, trace_text: str, detail: str) -> str:
    combined = f"{trace_text}\n{detail}".lower()
    if any(
        token in combined
        for token in (
            "services.translation",
            "translate_only_pipeline",
            "translate_from_ocr",
            "direct_typst.py",
            "deepseek",
            "placeholderinventoryerror",
            "unexpectedplaceholdererror",
            "translationprotocolerror",
            "protocol/json shell",
        )
    ):
        return "translation"
    if any(token in combined for token in ("render_stage.py", "services.rendering", "typst compile", "typst error", "render failed", "failed to render")):
        return "render"
    if "normaliz" in combined or "document_schema" in combined:
        return "normalization"
    return default_stage


def _http_status_code(exc: BaseException, text: str) -> int | None:
    response = getattr(exc, "response", None)
    status_code = getattr(response, "status_code", None)
    if isinstance(status_code, int):
        return status_code
    match = re.search(r"\b([45]\d{2})\s+Client Error\b", text)
    if match:
        return int(match.group(1))
    return None


def _extract_provider_code(text: str) -> str:
    patterns = (
        r"\bcode\s*[=:]\s*([A-Z]\d{3,}|[A-Z]{1,10}-\d{2,}|\d{3,})\b",
        r"\berror[_\s-]*code\s*[=:]\s*([A-Z]\d{3,}|[A-Z]{1,10}-\d{2,}|\d{3,})\b",
        r"\blogId\s*[=:]\s*([A-Za-z0-9_-]{6,})\b",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def _extract_provider_stage(text: str) -> str:
    known_stages = (
        "mineru_upload",
        "mineru_processing",
        "paddle_processing",
        "paddle_running",
        "paddle_submit",
    )
    lowered = text.lower()
    for stage in known_stages:
        if stage in lowered:
            return stage
    return ""


def _failure_category_for(*, failure_code: str, failed_stage: str) -> str:
    if failure_code in {"auth_failed"}:
        return "auth"
    if failure_code in {"dns_resolution_failed"}:
        return "network"
    if failure_code in {"upstream_timeout"}:
        return "timeout"
    if failure_code in {"upstream_rate_limited"}:
        return "rate_limit"
    if failure_code in {
        "upstream_bad_request",
        "source_pdf_missing",
        "source_pdf_open_failed",
    }:
        return "input"
    if failed_stage == "normalization" or failure_code in {
        "json_decode_failed",
        "document_schema_validation_failed",
    }:
        return "normalization"
    if failed_stage == "render" or failure_code in {
        "typst_dependency_download_failed",
        "render_failed",
    }:
        return "render"
    if failed_stage == "translation" or failure_code in {"placeholder_unstable", "translation_protocol_shell"}:
        return "translation"
    return "internal"


def _suggestion_for(*, failure_code: str, failure_category: str, provider: str) -> str:
    provider_label = provider.strip() or "Upstream service"
    suggestions = {
        "auth_failed": f"Check {provider_label} Credentials, Models API Key or whether the associated access token is valid.",
        "dns_resolution_failed": "Check the current machine's DNS / Network connectivity. Confirm target domain resolvable before retrying.",
        "upstream_timeout": "Check network quality, upstream load, or increase timeout; then retry.",
        "upstream_rate_limited": f"{provider_label} Rate limit exceeded. Retry later or reduce concurrency.",
        "upstream_bad_request": "Check request parameters, input files, and upstream interface constraints; correct and retry.",
        "placeholder_unstable": "Check formula placeholder protection chain and current batch input; reduce batch size or switch to conservative mode if necessary.",
        "translation_protocol_shell": "Check translation prompt and model response; this error usually means the model output. JSON/protocol shell instead of plain translation.",
"typst_dependency_download_failed": "Check Typst Dependency source network connectivity; preheat or retry if necessary.",
        "render_failed": "Check rendering input, fonts, and Typst Compilation log. Fix rendering issues and retry.",
"json_decode_failed": "Check OCR Original result complete and valid? Re-fetch or regenerate if necessary.",
        "document_schema_validation_failed": "Check if standardized output meets requirements. document.v1 Contract. Re-execute subsequent stages.",
        "source_pdf_missing": "Check task working directory and source. PDF Path: verify file exists and accessible.",
        "source_pdf_open_failed": "Check source PDF Corrupt or unreadable. Replace input file and retry.",
    }
    if failure_code in suggestions:
        return suggestions[failure_code]
    category_suggestions = {
"auth": f"Check {provider_label} authentication configuration and permission scope.",
        "network": "Check network, proxy, and DNS Configure then retry.",
        "timeout": "Check upstream service response time or increase timeout and retry.",
        "rate_limit": "Lower concurrency, wait for rate limit window recovery, then retry.",
        "input": "Validate input, file path, and request parameters.",
"normalization": "Check OCR Output and standardized input contract.",
        "translation": "Check translation stage input, batch partitioning, and model output.",
        "render": "Check render input, fonts, and build environment.",
"provider": f"Check {provider_label} the returned error code and original response.",
"internal": "Check traceback task_logs to locate uncategorized internal exceptions",
    }
return category_suggestions.get(failure_category, "Check traceback task log; root cause analysis failed.")


def _build_raw_excerpt(detail: str, raw_traceback: str) -> str:
    text = detail.strip()
    if not text:
        lines = [line.strip() for line in raw_traceback.splitlines() if line.strip()]
        text = lines[-1] if lines else ""
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= 280:
        return compact
    return compact[:277].rstrip() + "..."


def classify_exception(exc: BaseException, *, default_stage: str, provider: str = "") -> StructuredFailure:
    raw_traceback = traceback.format_exc()
    exc_type = type(exc).__name__
    message = str(exc).strip()
    detail = message or exc_type
    lowered = f"{exc_type}\n{detail}\n{raw_traceback}".lower()
    stage = infer_failure_stage(default_stage=default_stage, trace_text=raw_traceback, detail=detail)
    upstream_host = _extract_upstream_host(f"{detail}\n{raw_traceback}")
    http_status_code = _http_status_code(exc, f"{detail}\n{raw_traceback}")
    provider_code = _extract_provider_code(f"{detail}\n{raw_traceback}")
    provider_stage = _extract_provider_stage(f"{detail}\n{raw_traceback}")

    error_type = "python_unhandled_exception"
summary = "Task failed, but no clear root cause identified yet"
    retryable = True

    if any(token in lowered for token in ("failed to resolve", "temporary failure in name resolution", "nameresolutionerror", "socket.gaierror")):
        error_type = "dns_resolution_failed"
        summary = "External service DNS resolution failed."
    elif any(token in lowered for token in ("readtimeout", "connecttimeout", "timed out")):
        error_type = "upstream_timeout"
summary = "External service request timed out"
    elif stage == "render" and any(token in lowered for token in ("filenotfounderror", "no such file or directory")):
        error_type = "render_failed"
summary = "Typesetting or compilation stage failed"
        retryable = True
    elif http_status_code == 429 or any(token in lowered for token in ("rate limited", "rate limit", "too many requests", "retry-after")):
        error_type = "upstream_rate_limited"
        summary = "External service request rate-limited."
    elif http_status_code in {401, 403} or any(
        token in lowered
        for token in (
            "unauthorized",
            "forbidden",
            "invalid api key",
            "token expired",
            "missing api key",
            "missing or invalid x-api-key",
        )
    ):
        error_type = "auth_failed"
summary = "Authentication failed"
        retryable = False
    elif http_status_code == 400:
        error_type = "upstream_bad_request"
summary = "Upstream service rejected the request (400)"
        retryable = False
    elif any(
        token in lowered
        for token in (
            "placeholderinventoryerror",
            "unexpectedplaceholdererror",
            "placeholder inventory mismatch",
            "placeholder instability",
        )
    ):
        error_type = "placeholder_unstable"
summary = "Formula placeholder validation failed"
    elif any(token in lowered for token in ("translationprotocolerror", "protocol/json shell")):
        error_type = "translation_protocol_shell"
        summary = "Translation model returned protocol or JSON Shell"
        stage = "translation"
    elif any(token in lowered for token in ("failed to download package", "packages.typst.org", "downloading @preview/")):
        error_type = "typst_dependency_download_failed"
summary = "Typst rendering dependency download failed"
    elif any(
        token in lowered
        for token in (
            "typst runtime failed to start",
            "winerror 193",
            "winerror 5",
        )
    ):
        error_type = "typst_runtime_failed"
        summary = "Typst runtime startup failed"
        retryable = False
        stage = "render"
    elif any(token in lowered for token in ("typst compile", "typst error", "render failed", "failed to render", "font not found", "missing bundled font")):
        error_type = "render_failed"
summary = "Typesetting or compilation stage failed"
        retryable = False
        stage = "render"
    elif any(token in lowered for token in ("jsondecodeerror", "expecting value", "extra data", "invalid control character")):
        error_type = "json_decode_failed"
summary = "OCR result JSON Parse failed"
        stage = "normalization"
        retryable = False
    elif any(token in lowered for token in ("validationerror", "normalized document schema validation failed")):
        error_type = "document_schema_validation_failed"
summary = "Normalized document schema validation failed"
        stage = "normalization"
        retryable = False
    elif "source pdf not found" in lowered:
        error_type = "source_pdf_missing"
summary = "Source PDF missing"
        stage = "normalization"
        retryable = False
    elif any(token in lowered for token in ("fitz.fitzerror", "pymupdf", "cannot open broken document", "file data error")):
        error_type = "source_pdf_open_failed"
summary = "Source PDF Open failed."
        stage = "normalization"
        retryable = False

    failure_category = _failure_category_for(failure_code=error_type, failed_stage=stage)
    if provider.strip() and failure_category == "internal" and provider.strip() != "translation":
        failure_category = "provider"
    suggestion = _suggestion_for(
        failure_code=error_type,
        failure_category=failure_category,
        provider=provider,
    )
    raw_excerpt = _build_raw_excerpt(detail, raw_traceback)

    return StructuredFailure(
        failed_stage=stage,
        failure_code=error_type,
        failure_category=failure_category,
        provider_stage=provider_stage,
        provider_code=provider_code,
        suggestion=suggestion,
        raw_excerpt=raw_excerpt,
        stage=stage,
        error_type=error_type,
        summary=summary,
        detail=detail,
        retryable=retryable,
        upstream_host=upstream_host,
        provider=provider.strip(),
        raw_exception_type=exc_type,
        raw_exception_message=message,
        traceback=raw_traceback.strip(),
    )


def emit_structured_failure(exc: BaseException, *, default_stage: str, provider: str = "") -> None:
    failure = classify_exception(exc, default_stage=default_stage, provider=provider)
    traceback_text = failure.traceback.strip()
    if traceback_text:
        print(traceback_text, file=sys.stderr, flush=True)
    print(f"{STRUCTURED_FAILURE_LABEL}: {failure.to_json()}", file=sys.stderr, flush=True)


def run_with_structured_failure(main_fn: Any, *, default_stage: str, provider: str = "") -> None:
    try:
        main_fn()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        emit_structured_failure(exc, default_stage=default_stage, provider=provider)
        raise SystemExit(1) from None
