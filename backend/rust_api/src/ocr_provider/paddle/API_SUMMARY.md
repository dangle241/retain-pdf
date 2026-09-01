# Paddle OCR API Summary

This document answers one question:

**Currently integrated Paddle OCR Asynchronous API — actual protocol details.**

Does not cover `document.v1`, rendering, or translation — only the provider transport layer.

Related materials:

- Paddle Official async API example:
  [`AsyncParse.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/AsyncParse.md)
- Rust client：
  [`client.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/client.rs)
- Python client：
  [`backend/scripts/services/ocr_provider/paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)
- provider boundary:
  [`PROVIDER_BOUNDARY.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/PROVIDER_BOUNDARY.md)

## 1. Which API set is currently in use?

The current main connection is Paddle OCR Async task interface:

- `POST /api/v2/ocr/jobs`
- `GET /api/v2/ocr/jobs/{jobId}`
- download `resultUrl.jsonUrl`

Default base address:

- `https://paddleocr.aistudio-app.com`

Current code entry:

- Rust：
  [`client.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/client.rs)
- Python：
  [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 2. Auth method.

Request headers:

```http
Authorization: bearer <token>
Accept: application/json
```

Current code practice:

- Environment variables:`RETAIN_PADDLE_API_TOKEN`
- Local env file: `backend/scripts/.env/paddle.env`

Python Read port:

- [`get_paddle_token(...)`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 3. Three-part protocol

### 3.1 submit

Endpoint:

- `POST /api/v2/ocr/jobs`

Two submission methods:

1. Local file upload
2. Remote URL submit

Currently supported two invocation types:

- Python：
  - `submit_local_file(...)`
  - `submit_remote_url(...)`
- Rust：
  - `submit_local_file(...)`
  - `submit_remote_url(...)`

Key input parameters:

- `model`
- `optionalPayload`
- For local files multipart `file`
- For remote files JSON `fileUrl`

Most critical response fields on success:

- `data.jobId`

## 3.2 poll

Endpoint:

- `GET /api/v2/ocr/jobs/{jobId}`

Relevant return fields:

- `data.state`
- `data.extractProgress.totalPages`
- `data.extractProgress.extractedPages`
- `data.resultUrl.jsonUrl`
- `data.errorMsg`

Unified state mapping in current system:

- `pending` -> queued
- `running` -> processing
- `done` -> succeeded
- `failed` -> failed

Corresponding implementation:

- [`status.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/status.rs)

## 3.3 download result

After completion, do not directly retrieve structured. JSONbut instead to download:

- `resultUrl.jsonUrl`

This URL returns `jsonl`, not a single JSON.

Current unpack logic: per line:

- `result.layoutParsingResults`
- `result.dataInfo`

Merge into subsequent. adapter Consumable provider raw payload。

Corresponding implementation:

- Rust：
  [`client.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/client.rs)
- Python：
  [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 4. Actual key params passed.

### `model`

Current default model name:

- `PaddleOCR-VL-1.6`

Defaults from shared configuration:

- [`backend/config/ocr_providers.json`](/home/wxyhgk/tmp/Code/backend/config/ocr_providers.json)

Compatibility normalization:

- `paddleocr-vl`
- `paddle-ocr-vl`
- `paddleocr-vl-1.6`
- `paddle-ocr-vl-1.6`
- `paddleocr-vl-1.5`
- `paddle-ocr-vl-1.5`

### `optionalPayload`

Current code constructs differently based on model name. payload：

- `PaddleOCR-VL(-1.6/-1.5)` Use defaults. rich-content Parameters
- `PP-StructureV3` Use another set of structured parameters.

Corresponding implementation:

- [`build_optional_payload(...)`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)

## 5. Error caliber.

The transport layer currently handles these error types:

- HTTP status error
- provider returns `errorCode != 0`
- Return structure incomplete.
- `jobId` missing
- `resultUrl.jsonUrl` missing
- polling timeout
- JSONL Extraction failed.

Rust Unify error mapping:

- [`errors.rs`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/errors.rs)

## 6. Boundary with `document.v1`

Fields still belonging to provider transport layer:

- `jobId`
- `state`
- `extractProgress`
- `resultUrl.jsonUrl`
- `errorCode`
- `errorMsg`

After download and unpack. `jsonl` After:

- `layoutParsingResults`
- `dataInfo`

Only then proceed. adapterultimately becomes:

- `document.v1.json`

Do not mix provider task-state fields directly into the unified document layer.

## 7. Currently validated metric definition

Real local chain verified:

- `workflow = book`
- `ocr.provider = paddle`
- `translation.base_url = https://api.deepseek.com/v1`
- `translation.model = deepseek-v4-flash`

Can run successfully:

- upload
- Paddle OCR submit
- poll
- result download
- normalize
- translate
- render

This indicates that in the current repository Paddle API Integration is not a paper agreement, but connectivity with the main chain.
