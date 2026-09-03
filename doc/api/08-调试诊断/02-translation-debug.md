# Translation Debug API

These interfaces troubleshoot translation omissions, output errors, model anomalies, and replay。

## Diagnostics

```http
GET /api/v1/jobs/{job_id}/translation/diagnostics
```

Read artifacts/translation_diagnostics.json for translation run statistics, provider stats, retry stats, and other information.

## Item list

```http
GET /api/v1/jobs/{job_id}/translation/items
```

Common query parameters:

- `page`
- `final_status`
- `error_type`
- `route`
- `q`
- `limit`
- `offset`

Read preferentially `translation_debug_index.json`if missing, obtain from translation manifest Rollback index construction.

## Single item

```http
GET /api/v1/jobs/{job_id}/translation/items/{item_id}
```

From translation manifest, point to page payload to check original item.

## Replay

```http
POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay
```

Replay Immediate debug call:

- No new files. job。
- Skip queue.
- Do not modify original task status.
- Backend synchronous call `backend/scripts/devtools/replay_translation_item.py`。
- Use current job translation API key。

## Desensitization rules

## Desensitization rules
