# Troubleshooting

For detailed task details, event stream, failure protocol, and phase timeline, first refer to Rust API description.

## Read README first.

When a task fails, troubleshoot in this order:

1. `GET /api/v1/jobs/{job_id}`
2. `failure`
3. `failure_diagnostic`
4. `log_tail`
5. `GET /api/v1/jobs/{job_id}/events`
6. `runtime.stage_history`

`failure` It is the root cause of structured failure;`failure_diagnostic` Compatibility view retained for legacy frontend and simplified display.

## Common commands

```bash
curl http://127.0.0.1:41000/health

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}

curl -H "X-API-Key: your-key" \
  "http://127.0.0.1:41000/api/v1/jobs/{job_id}/events?limit=200"

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}/artifacts-manifest
```

## Task directory

Key points:

- `DATA_ROOT/jobs/{job_id}/logs/pipeline_events.jsonl`
- `DATA_ROOT/jobs/{job_id}/ocr/`
- `DATA_ROOT/jobs/{job_id}/translated/`
- `DATA_ROOT/jobs/{job_id}/rendered/`
- `DATA_ROOT/jobs/{job_id}/artifacts/`

Previous tasks may be used. `logs/events.jsonl`。

## Download button disabled

Do not just look at `status`. Should check:

- `actions.download_pdf.enabled`
- `actions.open_markdown.enabled`
- `actions.open_markdown_raw.enabled`
- `actions.download_bundle.enabled`
- `artifacts.pdf.ready`
- `artifacts.markdown.ready`
- `artifacts.bundle.ready`
- `artifacts-manifest.items[].ready`

If ready=false or enabled=false, do not manually construct download URLs or force access.

## Provider errors

Common causes:

- `mineru_token`、`paddle_token`、`api_key` Missing or invalid.
- PDF Exceeds upstream Provider Restrictions.
- Backend host machine DNSProxy or network anomaly. Check connection.
- Upstream interface temporary disconnect.

Source text missing. Provide content to translate.

- `provider_trace_id`
- `failure.provider`
- `failure.root_cause`
- `failure.suggestion`
- log_tail contains CAUSE[n] lines.

## Translation debugging

Check when translation phase exception occurs:

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

These interfaces are for development and troubleshooting; not recommended as dependencies for normal user workflows.

## Common error codes

- `40000`Request error, e.g., missing fields.JSON Structure does not match contract.
- `40100`Missing or invalid `X-API-Key`。
- `40400`Task:artifact or resource not found.
- `40900`Task status conflict.
- `50000`Backend internal error.
