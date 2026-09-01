# Provider Validate interface

## 1. MinerU token validation

Interface:

`POST /api/v1/providers/mineru/validate-token`

Purpose:

- Detect before saving or submitting OCR configuration whether mineru_token is available
- avoid waiting until actual creation OCR Only discovered at runtime after task. Token Invalid or expired

## 2. Request Body

```json
{
  "mineru_token": "mineru-xxxx",
  "base_url": "https://mineru.net",
  "model_version": "vlm"
}
```

Field descriptions:

- `mineru_token`
  - Required, pending validation. MinerU Token
- `base_url`
  - Optional, default `https://mineru.net`
- `model_version`
- Optional, default vlm

## 3. Return structure

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "ok": false,
    "status": "expired",
"summary": "MinerU Token expired",
    "retryable": false,
    "provider_code": "A0211",
    "provider_message": "token expired",
"operator_hint": "Replace with new token",
    "trace_id": "trace-1",
    "base_url": "https://mineru.net",
    "checked_at": "2026-04-06T08:30:00Z"
  }
}
```

## 4. `status` Fixed

- `valid`
- Token is available
- `unauthorized`
- Token is invalid
- `expired`
- Token has expired
- `network_error`
  - Current machine to MinerU Connectivity probe failed.
- `provider_error`
  - MinerU Other error returned, not falling into previous categories.

## 5. How to use the frontend

Recommended flow:

1. User input or update MinerU Token
2. Frontend calls this API.
3. Give immediate feedback based on data.status
4. Only submit an OCR or translation task later if status=valid

Recommended display:

- Success:`summary`
- On failure: summary + operator_hint
- Debug Mode: Supplement `provider_code / provider_message / trace_id`

## 6. Implement conventions

- This API calls MinerU Lightweight probe request validation. Authorization
- It will not actually create an OCR task
- Upload fails. Check network connection. Retry. PDF
- Its only goal is early detection:
- Token is invalid
- Token has expired
  - Currently cannot connect to the network MinerU

## 7. Relation to runtime failure diagnosis.

This endpoint is a pre-validation check.

If the issue persists at runtime. MinerU Auth issue: backend task failure diagnostics still identify:

- A0202 -> invalid token
- A0211 -> token expired

So the two layers are complementary:

- Before submit: use this API to intercept early.
- Running: failure diagnosis fallback attribution.
