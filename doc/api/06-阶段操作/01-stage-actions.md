# stage-actions

## Endpoint

```http
GET /api/v1/jobs/{job_id}/stage-actions
```

Query whether each stage can be actively retried, and which artifacts are reused and rerun on retry.

## Response example

```json
{
  "job_id": "xxx",
  "stages": [
    {
      "stage": "translation",
"label": "Retry translation",
      "can_retry": true,
      "disabled_reason": "",
      "will_reuse": ["source_pdf", "ocr_result"],
      "will_rerun": ["translation", "render"],
      "danger": false,
      "action": {
        "method": "POST",
        "url": "/api/v1/jobs/xxx/retry-stage",
        "body": {
          "stage": "translation"
        }
      }
    }
  ]
}
```

## Frontend rules

- As returned by backend `can_retry` Determines whether button is clickable.
- Don't guess frontend reusable artifacts.
- will_reuse and will_rerun are for display and confirmation only.
- Actual execution is based on action and retry-stage.
