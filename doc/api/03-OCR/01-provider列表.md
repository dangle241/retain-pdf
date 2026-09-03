# OCR Provider list

## Endpoint

```http
GET /api/v1/providers/ocr
```

Used to discover what the backend currently supports. OCR providerCredential field configurable optionsLayout capabilities products.

## Response example

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "key": "paddle",
      "display_name": "PaddleOCR",
      "provider_kind": "remote",
      "credential": {
        "field": "paddle_token",
        "env": "RETAIN_PADDLE_API_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "paddle_model": {
          "type": "string",
          "default": "PaddleOCR-VL-1.6",
          "aliases": {
            "paddleocr-vl": "PaddleOCR-VL-1.6"
          }
        }
      },
      "capabilities": {
        "supports_remote_url_submit": true,
        "supports_local_file_upload": true,
        "supports_polling": true,
        "supports_download_bundle": true,
        "supports_extra_formats": false,
        "supports_formula_toggle": false,
        "supports_table_toggle": false
      },
      "artifact_layout": {
        "provider_result_json": "paddle_result.json",
        "provider_bundle_zip": "paddle_bundle.zip",
        "provider_raw_dir": "paddle_raw",
        "layout_json": "paddle_result.json"
      }
    }
  ]
}
```

## provider_kind

- remote: built-in remote provider, e.g., MinerU, Paddle.
- `local_command`: Local configuration commands provider。
- `remote_command`: Configuration Remote Command provider。

## Frontend rules

- Don't hardcode. Use config files. provider Parameter table.
- Form fields generated from credential and options.
- If credential is null, do not display credential input.
- provider-specific Write non-key parameters. `ocr.options`。
