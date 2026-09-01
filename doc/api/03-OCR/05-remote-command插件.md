# remote_command plugin

remote_command connects to new remote OCR services, but without writing submit/poll/download state machines into the Rust main flow.

## Design principles

- Backend only responsible for starting plugin commands and passing source, options, credentials, and artifact paths.
- Plugin commands handle remote operations. API Submit, poll, download, retry.
- Main workflow only consumes source PDF and document.v1.json.

## Configuration Example

```json
{
  "providers": {
    "my_remote_ocr": {
      "display_name": "My Remote OCR",
      "kind": "remote_command",
      "credential": {
        "field": "credential",
        "env": "RETAIN_MY_REMOTE_OCR_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "command": {
          "type": "string",
          "default": "python /path/to/my_remote_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

## Credentials

Configuration command provider Credentials can come from:

- `ocr.options.credential`
- `ocr.options.token`
- `ocr.options.api_key`
- provider config credential.env

worker Writes parsed key to:

```text
RETAIN_OCR_CREDENTIAL
```

If configured `credential.env`Plugins can also read their own environment variables.

## URL Input Contract

When task source.file_url is used:

- `RETAIN_OCR_SOURCE_URL` Contains original URL。
- `RETAIN_OCR_SOURCE_PDF` May be empty.
- Plugin must write the final source PDF to RETAIN_OCR_SOURCE_DIR.

If the plugin does not land. source PDFTask will fail because subsequent translation and rendering must use local. source artifact。
