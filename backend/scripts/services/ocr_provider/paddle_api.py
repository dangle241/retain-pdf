from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from typing import Callable

import requests

from foundation.shared.local_env import get_secret
from services.network.retry import RetainNetworkError
from services.network.retry import RetainRateLimitError
from services.network.retry import direct_session
from services.network.retry import request_with_retry
from services.network.retry import stepped_poll_interval
from services.ocr_provider.provider_config import normalize_paddle_model_name


PADDLE_BASE_URL = "https://paddleocr.aistudio-app.com"
PADDLE_TOKEN_ENV = "RETAIN_PADDLE_API_TOKEN"
PADDLE_ENV_FILE = "paddle.env"
PADDLE_RETRY_ATTEMPTS_ENV = "RETAIN_PADDLE_RETRY_ATTEMPTS"
PADDLE_RETRY_BACKOFF_ENV = "RETAIN_PADDLE_RETRY_BACKOFF_SECONDS"
PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV = "RETAIN_PADDLE_SUBMIT_RETRY_ATTEMPTS"
PADDLE_SUBMIT_TLS_RETRY_ATTEMPTS_ENV = "RETAIN_PADDLE_SUBMIT_TLS_RETRY_ATTEMPTS"
PADDLE_SUBMIT_TRANSPORT_ENV = "RETAIN_PADDLE_SUBMIT_TRANSPORT"
_SESSION: requests.Session | None = None


class PaddleNetworkError(RetainNetworkError):
    pass


class PaddleRateLimitError(RetainRateLimitError, PaddleNetworkError):
    pass


def get_paddle_token(*, explicit_value: str = "") -> str:
    return get_secret(
        explicit_value=explicit_value,
        env_var=PADDLE_TOKEN_ENV,
        env_file_name=PADDLE_ENV_FILE,
    )


def normalize_model_name(model: str) -> str:
    return normalize_paddle_model_name(model)


def build_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"bearer {token.strip()}",
        "Accept": "application/json",
    }


def _retry_attempts() -> int:
    raw = os.environ.get(PADDLE_RETRY_ATTEMPTS_ENV, "").strip()
    try:
        value = int(raw) if raw else 3
    except ValueError:
        value = 3
    return max(1, value)


def _retry_backoff_seconds() -> float:
    raw = os.environ.get(PADDLE_RETRY_BACKOFF_ENV, "").strip()
    try:
        value = float(raw) if raw else 0.5
    except ValueError:
        value = 0.5
    return max(0.1, value)


def _submit_transport_retry_attempts() -> int:
    raw = os.environ.get(PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV, "").strip()
    if not raw:
        raw = os.environ.get(PADDLE_SUBMIT_TLS_RETRY_ATTEMPTS_ENV, "").strip()
    try:
        value = int(raw) if raw else 3
    except ValueError:
        value = 3
    return max(1, value)


def _submit_transport() -> str:
    value = os.environ.get(PADDLE_SUBMIT_TRANSPORT_ENV, "auto").strip().lower()
    return value if value in {"auto", "requests", "curl"} else "auto"


def _is_retryable_submit_transport_error(error: BaseException) -> bool:
    current: BaseException | None = error
    visited: set[int] = set()
    while current is not None and id(current) not in visited:
        visited.add(id(current))
        if isinstance(current, requests.exceptions.SSLError):
            detail = str(current).lower()
            if "unexpected_eof_while_reading" in detail or "eof occurred in violation of protocol" in detail:
                return True
        if isinstance(current, requests.exceptions.ConnectionError):
            detail = str(current).lower()
            if any(
                marker in detail
                for marker in (
                    "failed to resolve",
                    "name resolution",
                    "name or service not known",
                    "nodename nor servname provided",
                    "failed to establish a new connection",
                    "connection refused",
                    "write operation timed out",
                    "remote end closed connection without response",
                    "remotedisconnected",
                )
            ):
                return True
        current = current.__cause__ or current.__context__
    return False


def _build_session() -> requests.Session:
    return direct_session(pool_connections=8, pool_maxsize=8)


def _get_session() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        _SESSION = _build_session()
    return _SESSION


def _request_with_retry(method: str, url: str, *, timeout: int, **kwargs: Any) -> requests.Response:
    try:
        return request_with_retry(
            _get_session(),
            method,
            url,
            timeout=timeout,
            attempts=_retry_attempts(),
            backoff_seconds=_retry_backoff_seconds(),
            label="Paddle OCR",
            **kwargs,
        )
    except RetainRateLimitError as err:
        raise PaddleRateLimitError(str(err)) from err
    except RetainNetworkError as err:
        raise PaddleNetworkError(str(err)) from err


def build_optional_payload(model: str) -> dict[str, Any]:
    normalized = normalize_model_name(model).lower()
    if "pp-ocrv5" in normalized:
        return {
            "useDocOrientationClassify": False,
            "useDocUnwarping": False,
            "useTextlineOrientation": False,
        }
    return {
        "useDocOrientationClassify": False,
        "useDocUnwarping": False,
        "useChartRecognition": False,
    }


def _check_envelope(payload: dict[str, Any], *, stage: str) -> dict[str, Any]:
    if int(payload.get("errorCode", 0) or 0) != 0:
        raise RuntimeError(
            f"Paddle {stage} failed: code={payload.get('errorCode')} msg={payload.get('errorMsg', '')} logId={payload.get('logId', '')}"
        )
    return payload


def _submit_local_file_with_curl(
    *,
    token: str,
    file_path: Path,
    model: str,
    optional_payload: dict[str, Any],
    submit_url: str,
    page_ranges: str,
    timeout: int,
) -> tuple[str, str]:
    curl_bin = shutil.which("curl")
    if not curl_bin:
        raise PaddleNetworkError("Paddle curl submit transport is unavailable")
    escaped_file_path = str(file_path).replace("\\", "\\\\").replace('"', '\\"')
    command = [
        curl_bin,
        "--silent",
        "--show-error",
        "--http1.1",
        "--connect-timeout",
        str(min(15, max(1, timeout))),
        "--max-time",
        str(max(1, timeout)),
        "--header",
        "@-",
        "--form-string",
        f"model={model}",
        "--form-string",
        f"optionalPayload={json.dumps(optional_payload, ensure_ascii=False)}",
    ]
    if page_ranges.strip():
        command.extend(["--form-string", f"pageRanges={page_ranges.strip()}"])
    command.extend(
        [
            "--form",
            f'file=@"{escaped_file_path}"',
            "--write-out",
            "\n%{http_code}",
            submit_url,
        ]
    )
    headers = f"Authorization: bearer {token.strip()}\nAccept: application/json\n"
    try:
        result = subprocess.run(
            command,
            input=headers.encode("utf-8"),
            capture_output=True,
            check=False,
            timeout=max(1, timeout) + 15,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PaddleNetworkError(f"Paddle curl submit failed: {type(error).__name__}: {error}") from error
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        detail = detail.replace(token.strip(), "[REDACTED]")[:2000]
        raise PaddleNetworkError(
            f"Paddle curl submit failed: exit_code={result.returncode} detail={detail}"
        )
    body, separator, status_text = result.stdout.rpartition(b"\n")
    if not separator or not status_text.isdigit():
        raise PaddleNetworkError("Paddle curl submit returned an invalid HTTP status trailer")
    status = int(status_text)
    response_text = body.decode("utf-8", errors="replace")
    if status < 200 or status >= 300:
        safe_body = response_text.replace(token.strip(), "[REDACTED]")[:2000]
        raise RuntimeError(f"Paddle submit HTTP {status}: {safe_body}")
    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Paddle submit returned invalid JSON: {error}") from error
    envelope = _check_envelope(dict(payload or {}), stage="submit")
    data = dict(envelope.get("data") or {})
    job_id = str(data.get("jobId", "") or "").strip()
    if not job_id:
        raise RuntimeError("Paddle submit returned empty jobId")
    return job_id, str(envelope.get("logId", "") or "").strip()


def submit_local_file(
    *,
    token: str,
    file_path: Path,
    model: str,
    optional_payload: dict[str, Any],
    base_url: str = "",
    page_ranges: str = "",
    timeout: int = 120,
) -> tuple[str, str]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    submit_url = f"{resolved_base}/api/v2/ocr/jobs"
    transport = _submit_transport()
    if transport == "curl":
        return _submit_local_file_with_curl(
            token=token,
            file_path=file_path,
            model=model,
            optional_payload=optional_payload,
            submit_url=submit_url,
            page_ranges=page_ranges,
            timeout=timeout,
        )
    file_bytes = file_path.read_bytes()
    form_data = {
        "model": model,
        "optionalPayload": json.dumps(optional_payload, ensure_ascii=False),
    }
    if page_ranges.strip():
        form_data["pageRanges"] = page_ranges.strip()
    transport_attempts = _submit_transport_retry_attempts()
    last_transport_error: PaddleNetworkError | None = None
    for attempt in range(1, transport_attempts + 1):
        try:
            response = _request_with_retry(
                "post",
                submit_url,
                headers=build_headers(token),
                data=form_data,
                files={"file": (file_path.name, file_bytes)},
                timeout=max(1, timeout),
            )
            last_transport_error = None
            break
        except PaddleNetworkError as error:
            if not _is_retryable_submit_transport_error(error):
                raise
            last_transport_error = error
            if attempt >= transport_attempts:
                break
            delay = min(10.0, _retry_backoff_seconds() * (2 ** (attempt - 1)))
            print(
                f"Paddle OCR submit transport retry {attempt}/{transport_attempts} "
                f"url={submit_url} sleep={delay:.2f}s",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(delay)
    else:
        raise RuntimeError("Paddle submit transport loop ended unexpectedly")
    if last_transport_error is not None:
        if transport != "auto" or not shutil.which("curl"):
            raise last_transport_error
        print(
            f"Paddle OCR submit switching to curl transport url={submit_url}",
            file=sys.stderr,
            flush=True,
        )
        return _submit_local_file_with_curl(
            token=token,
            file_path=file_path,
            model=model,
            optional_payload=optional_payload,
            submit_url=submit_url,
            page_ranges=page_ranges,
            timeout=timeout,
        )
    envelope = _check_envelope(response.json(), stage="submit")
    data = dict(envelope.get("data") or {})
    job_id = str(data.get("jobId", "") or "").strip()
    if not job_id:
        raise RuntimeError("Paddle submit returned empty jobId")
    return job_id, str(envelope.get("logId", "") or "").strip()


def submit_remote_url(
    *,
    token: str,
    source_url: str,
    model: str,
    optional_payload: dict[str, Any],
    base_url: str = "",
) -> tuple[str, str]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    response = _request_with_retry(
        "post",
        f"{resolved_base}/api/v2/ocr/jobs",
        headers={**build_headers(token), "Content-Type": "application/json"},
        json={
            "fileUrl": source_url,
            "model": model,
            "optionalPayload": optional_payload,
        },
        timeout=120,
    )
    envelope = _check_envelope(response.json(), stage="submit")
    data = dict(envelope.get("data") or {})
    job_id = str(data.get("jobId", "") or "").strip()
    if not job_id:
        raise RuntimeError("Paddle submit returned empty jobId")
    return job_id, str(envelope.get("logId", "") or "").strip()


def query_job(*, token: str, job_id: str, base_url: str = "") -> dict[str, Any]:
    resolved_base = (base_url or PADDLE_BASE_URL).strip().rstrip("/")
    response = _request_with_retry(
        "get",
        f"{resolved_base}/api/v2/ocr/jobs/{job_id}",
        headers=build_headers(token),
        timeout=120,
    )
    envelope = _check_envelope(response.json(), stage="poll")
    return dict(envelope.get("data") or {})


def download_jsonl_result(*, jsonl_url: str) -> dict[str, Any]:
    response = _request_with_retry("get", jsonl_url, timeout=300)
    layout_results: list[Any] = []
    data_info: dict[str, Any] = {}
    line_count = 0
    for raw_line in response.text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line_count += 1
        payload = json.loads(line)
        result = dict(payload.get("result") or {})
        items = result.get("layoutParsingResults") or []
        if isinstance(items, list):
            layout_results.extend(items)
        if not data_info and isinstance(result.get("dataInfo"), dict):
            data_info = dict(result.get("dataInfo") or {})
    return {
        "layoutParsingResults": layout_results,
        "dataInfo": data_info,
        "_meta": {
            "source": "paddle_jsonl",
            "lineCount": line_count,
        },
    }


def poll_until_done(
    *,
    token: str,
    job_id: str,
    poll_interval: int,
    poll_timeout: int,
    base_url: str = "",
    progress_callback: Callable[[str, dict[str, Any]], None] | None = None,
) -> tuple[dict[str, Any], str]:
    started = time.time()
    while True:
        payload = query_job(token=token, job_id=job_id, base_url=base_url)
        state = str(payload.get("state", "") or "").strip()
        print(f"paddle task {job_id}: state={state}", flush=True)
        if progress_callback is not None:
            progress_callback(state, payload)
        if state == "done":
            result_url = dict(payload.get("resultUrl") or {})
            jsonl_url = str(result_url.get("jsonUrl", "") or "").strip()
            if not jsonl_url:
                raise RuntimeError("Paddle task finished but resultUrl.jsonUrl is missing")
            return payload, jsonl_url
        if state == "failed":
            raise RuntimeError(f"Paddle task failed: {payload.get('errorMsg', '') or 'unknown error'}")
        elapsed = time.time() - started
        if elapsed > poll_timeout:
            raise TimeoutError(f"Timed out waiting for Paddle task {job_id}")
        time.sleep(stepped_poll_interval(elapsed, poll_interval))
