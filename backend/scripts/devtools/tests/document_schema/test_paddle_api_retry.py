from __future__ import annotations

import sys
from pathlib import Path

import pytest
import requests


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.ocr_provider import paddle_api
from services.ocr_provider import paddle_markdown
from services.mineru import mineru_api
from services.network import retry as network_retry


class _Response:
    def __init__(self, status_code: int, headers: dict[str, str] | None = None) -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self.url = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
        self.reason = "error"

    def raise_for_status(self) -> None:
        raise requests.HTTPError(f"{self.status_code} Client Error", response=self)


class _Session:
    def __init__(self, response: _Response) -> None:
        self.response = response
        self.calls = 0

    def request(self, *_args, **_kwargs):
        self.calls += 1
        return self.response


def test_paddle_request_retries_429_and_raises_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))
    sleeps: list[float] = []

    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(paddle_api.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(paddle_api.PaddleRateLimitError):
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert session.calls == 2
    assert sleeps == [1.0]


def test_paddle_request_does_not_retry_auth_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(401))

    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    with pytest.raises(requests.HTTPError):
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert session.calls == 1


def test_paddle_submit_retries_unexpected_tls_eof(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    class SuccessResponse:
        def json(self):
            return {
                "errorCode": 0,
                "errorMsg": "Success",
                "logId": "trace-test",
                "data": {"jobId": "paddle-test"},
            }

    calls = 0
    sleeps: list[float] = []

    def fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            ssl_error = requests.exceptions.SSLError(
                "[SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol"
            )
            try:
                raise ssl_error
            except requests.exceptions.SSLError as cause:
                raise paddle_api.PaddleNetworkError("TLS submit failed") from cause
        return SuccessResponse()

    source = tmp_path / "source.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    monkeypatch.setattr(paddle_api, "_request_with_retry", fake_request)
    monkeypatch.setattr(paddle_api.time, "sleep", lambda seconds: sleeps.append(seconds))
    monkeypatch.setenv(paddle_api.PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV, "3")

    job_id, trace_id = paddle_api.submit_local_file(
        token="test-token",
        file_path=source,
        model="PaddleOCR-VL-1.6",
        optional_payload={},
        timeout=1,
    )

    assert job_id == "paddle-test"
    assert trace_id == "trace-test"
    assert calls == 2
    assert sleeps == [0.5]
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "Paddle OCR submit transport retry 1/3" in captured.err


def test_paddle_submit_retries_dns_resolution_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    class SuccessResponse:
        def json(self):
            return {
                "errorCode": 0,
                "errorMsg": "Success",
                "logId": "trace-dns-test",
                "data": {"jobId": "paddle-dns-test"},
            }

    calls = 0

    def fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            dns_error = requests.exceptions.ConnectionError(
                "NameResolutionError: Failed to resolve "
                "'paddleocr.aistudio-app.com' ([Errno -2] Name or service not known)"
            )
            try:
                raise dns_error
            except requests.exceptions.ConnectionError as cause:
                raise paddle_api.PaddleNetworkError("DNS submit failed") from cause
        return SuccessResponse()

    source = tmp_path / "source.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    monkeypatch.setattr(paddle_api, "_request_with_retry", fake_request)
    monkeypatch.setattr(paddle_api.time, "sleep", lambda _seconds: None)
    monkeypatch.setenv(paddle_api.PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV, "3")

    job_id, trace_id = paddle_api.submit_local_file(
        token="test-token",
        file_path=source,
        model="PaddleOCR-VL-1.6",
        optional_payload={},
        timeout=1,
    )

    assert job_id == "paddle-dns-test"
    assert trace_id == "trace-dns-test"
    assert calls == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "Paddle OCR submit transport retry 1/3" in captured.err


def test_paddle_submit_retries_remote_disconnect(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    class SuccessResponse:
        def json(self):
            return {
                "errorCode": 0,
                "errorMsg": "Success",
                "logId": "trace-disconnect-test",
                "data": {"jobId": "paddle-disconnect-test"},
            }

    calls = 0

    def fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            disconnect_error = requests.exceptions.ConnectionError(
                "('Connection aborted.', "
                "RemoteDisconnected('Remote end closed connection without response'))"
            )
            try:
                raise disconnect_error
            except requests.exceptions.ConnectionError as cause:
                raise paddle_api.PaddleNetworkError("submit connection closed") from cause
        return SuccessResponse()

    source = tmp_path / "source.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    monkeypatch.setattr(paddle_api, "_request_with_retry", fake_request)
    monkeypatch.setattr(paddle_api.time, "sleep", lambda _seconds: None)
    monkeypatch.setenv(paddle_api.PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV, "3")

    job_id, trace_id = paddle_api.submit_local_file(
        token="test-token",
        file_path=source,
        model="PaddleOCR-VL-1.6",
        optional_payload={},
        timeout=1,
    )

    assert job_id == "paddle-disconnect-test"
    assert trace_id == "trace-disconnect-test"
    assert calls == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "Paddle OCR submit transport retry 1/3" in captured.err


def test_paddle_submit_retries_connection_refused(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class SuccessResponse:
        def json(self):
            return {
                "errorCode": 0,
                "errorMsg": "Success",
                "logId": "trace-connect-test",
                "data": {"jobId": "paddle-connect-test"},
            }

    calls = 0

    def fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            connect_error = requests.exceptions.ConnectionError(
                "Failed to establish a new connection: [Errno 111] Connection refused"
            )
            try:
                raise connect_error
            except requests.exceptions.ConnectionError as cause:
                raise paddle_api.PaddleNetworkError("connect failed") from cause
        return SuccessResponse()

    source = tmp_path / "source.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    monkeypatch.setattr(paddle_api, "_request_with_retry", fake_request)
    monkeypatch.setattr(paddle_api.time, "sleep", lambda _seconds: None)
    monkeypatch.setenv(paddle_api.PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV, "3")

    job_id, trace_id = paddle_api.submit_local_file(
        token="test-token",
        file_path=source,
        model="PaddleOCR-VL-1.6",
        optional_payload={},
        timeout=1,
    )

    assert job_id == "paddle-connect-test"
    assert trace_id == "trace-connect-test"
    assert calls == 2


def test_paddle_submit_retries_write_timeout(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class SuccessResponse:
        def json(self):
            return {
                "errorCode": 0,
                "errorMsg": "Success",
                "logId": "trace-write-test",
                "data": {"jobId": "paddle-write-test"},
            }

    calls = 0

    def fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            write_error = requests.exceptions.ConnectionError(
                "('Connection aborted.', TimeoutError('The write operation timed out'))"
            )
            try:
                raise write_error
            except requests.exceptions.ConnectionError as cause:
                raise paddle_api.PaddleNetworkError("write failed") from cause
        return SuccessResponse()

    source = tmp_path / "source.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    monkeypatch.setattr(paddle_api, "_request_with_retry", fake_request)
    monkeypatch.setattr(paddle_api.time, "sleep", lambda _seconds: None)
    monkeypatch.setenv(paddle_api.PADDLE_SUBMIT_RETRY_ATTEMPTS_ENV, "3")

    job_id, trace_id = paddle_api.submit_local_file(
        token="test-token",
        file_path=source,
        model="PaddleOCR-VL-1.6",
        optional_payload={},
        timeout=1,
    )

    assert job_id == "paddle-write-test"
    assert trace_id == "trace-write-test"
    assert calls == 2


def test_paddle_curl_submit_keeps_token_out_of_process_arguments(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    source = tmp_path / "source, test.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    captured: dict[str, object] = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        captured["input"] = kwargs["input"]
        return paddle_api.subprocess.CompletedProcess(
            command,
            0,
            stdout=(
                b'{"errorCode":0,"errorMsg":"Success","logId":"curl-trace",'
                b'"data":{"jobId":"curl-job"}}\n200'
            ),
            stderr=b"",
        )

    monkeypatch.setenv(paddle_api.PADDLE_SUBMIT_TRANSPORT_ENV, "curl")
    monkeypatch.setattr(paddle_api.shutil, "which", lambda _name: "/usr/bin/curl")
    monkeypatch.setattr(paddle_api.subprocess, "run", fake_run)

    job_id, trace_id = paddle_api.submit_local_file(
        token="secret-test-token",
        file_path=source,
        model="PaddleOCR-VL-1.5",
        optional_payload={"useDocUnwarping": False},
        timeout=30,
    )

    assert job_id == "curl-job"
    assert trace_id == "curl-trace"
    assert "secret-test-token" not in " ".join(captured["command"])
    assert b"secret-test-token" in captured["input"]
    assert "@-" in captured["command"]
    assert any('file=@"' in argument for argument in captured["command"])


def test_paddle_optional_payload_matches_async_api_contract() -> None:
    payload = paddle_api.build_optional_payload("PaddleOCR-VL-1.5")
    assert payload == {
        "useDocOrientationClassify": False,
        "useDocUnwarping": False,
        "useChartRecognition": False,
    }

    ocr_payload = paddle_api.build_optional_payload("PP-OCRv5")
    assert ocr_payload["useTextlineOrientation"] is False
    assert "useChartRecognition" not in ocr_payload


def test_paddle_model_defaults_and_aliases_use_shared_config() -> None:
    assert paddle_api.normalize_model_name("") == "PaddleOCR-VL-1.5"
    assert paddle_api.normalize_model_name("paddleocr-vl") == "PaddleOCR-VL-1.5"
    assert paddle_api.normalize_model_name("paddle-ocr-vl-1.6") == "PaddleOCR-VL-1.6"
    assert paddle_api.normalize_model_name("paddleocr-vl-1.5") == "PaddleOCR-VL-1.5"


def test_mineru_request_retries_429_and_raises_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))
    sleeps: list[float] = []

    monkeypatch.setattr(mineru_api, "_get_session", lambda: session)
    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(mineru_api.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(mineru_api.MinerURateLimitError):
        mineru_api.request_mineru("get", "https://mineru.net/api/v4/extract/task/test", timeout=1)

    assert session.calls == 2
    assert sleeps == [1.0]


def test_sanitize_url_for_log_strips_query_and_fragment() -> None:
    signed_url = "https://cdn.example.com/bundle.zip?X-Amz-Signature=super-secret&X-Amz-Expires=900#frag"
    sanitized = network_retry.sanitize_url_for_log(signed_url)
    assert sanitized.startswith("https://cdn.example.com/bundle.zip")
    assert "super-secret" not in sanitized
    assert "X-Amz-Signature" not in sanitized
    assert "frag" not in sanitized


def test_sanitize_url_for_log_leaves_url_without_query_untouched() -> None:
    plain_url = "https://cdn.example.com/bundle.zip"
    assert network_retry.sanitize_url_for_log(plain_url) == plain_url


def test_mineru_request_retry_print_redacts_query_string(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))

    monkeypatch.setattr(mineru_api, "_get_session", lambda: session)
    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(mineru_api.time, "sleep", lambda seconds: None)

    signed_url = "https://mineru.net/api/v4/extract/task/test?token=SUPER-SECRET-TOKEN"
    with pytest.raises(mineru_api.MinerURateLimitError):
        mineru_api.request_mineru("get", signed_url, timeout=1)

    captured = capsys.readouterr()
    assert "SUPER-SECRET-TOKEN" not in captured.out
    assert "redacted" in captured.out


def test_paddle_markdown_remote_image_uses_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        content = b"image-bytes"

    calls: list[tuple[str, str]] = []

    def fake_request_with_retry(_session, method, url, **_kwargs):
        calls.append((method, url))
        return Response()

    monkeypatch.setattr(paddle_markdown, "request_with_retry", fake_request_with_retry)

    assert paddle_markdown.decode_paddle_markdown_image("https://example.test/image.png") == b"image-bytes"
    assert calls == [("get", "https://example.test/image.png")]
