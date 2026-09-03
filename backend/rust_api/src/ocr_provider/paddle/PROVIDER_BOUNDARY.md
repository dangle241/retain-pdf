# Paddle Provider Boundary

This document describes only one thing:

Paddle OCR provider API boundary and `document.v1` unified document boundary must be separated.

Related documents:

- API summary:
  [`API_SUMMARY.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/API_SUMMARY.md)
- Official async interface example:
  [`AsyncParse.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/AsyncParse.md)

## 1. Paddle Provider API Three-part boundary

According to [AsyncParse.md](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/AsyncParse.md), Paddle async interface naturally divides into three parts:

### `submit`

- `POST /api/v2/ocr/jobs`
- Input:
- `fileUrl` or multipart `file`
  - `model`
  - `optionalPayload`
- Output:
  - `jobId`

### `poll`

- `GET /api/v2/ocr/jobs/{jobId}`
- Status:
  - `pending`
  - `running`
  - `done`
  - `failed`
- Available during runtime:
  - `extractProgress.totalPages`
  - `extractProgress.extractedPages`
- After completion, available:
  - `resultUrl.jsonUrl`

### `download_result`

- Download `jsonUrl`
- Returns `jsonl`
- Line-by-line unpacking yields the actual:
  - `result.layoutParsingResults`
  - `result.dataInfo`

## 2. Provider API layer

The following belong to Paddle provider client / OCR service layer:

- `jobId`
- `state`
- `extractProgress`
- `resultUrl.jsonUrl`
- Submit parameters:
  - `model`
  - `optionalPayload`
  - `fileUrl`
  - multipart `file`

Purpose:

- Submit Task
- Polling Task
- Download result
- Failure Troubleshooting

They do not belong. `document.v1`。

## 3. Which ones enter `document.v1`

Only if `download_result` After `jsonl` actual extracted OCR Only page content enters the unified document layer:

- `layoutParsingResults`
- `dataInfo`

Subsequently by adapter handled by:

1. provider raw JSON
2. adapter Normalize
3. Generate `document.v1.json`

In other words:

- Paddle provider API Layer solves 'how tasks run'.
- `document.v1` Layer determines final document appearance.

Keep these two layers separate.

## 4. Current implementation recommendations

If later connecting Paddle in Rust or Python:

- provider client only responsible for:
  - submit
  - poll
  - download
  - Unpack jsonl
- adapter only responsible for:
  - `layoutParsingResults/dataInfo -> document.v1`
- Translation/main rendering pipeline accepts only:
  - `document.v1.json`

Don't include:

- `jobId`
- `state`
- `resultUrl`
- `extractProgress`

This category provider API Inject runtime fields. `document.v1`。
