# local_command Plugin

local_command is RetainPDF's minimal stable contract for connecting local OCR models.

It does not require you to start an HTTP service, but rather requires you to provide an executable command. RetainPDF, at OCR stage start, runs this command with input PDF paths, task directory, and output file paths passed via environment variables. Your command only needs to do one thing: write OCR results to the agreed location.

Typical forms:

```text
RetainPDF job
-> start local_command
-> local OCR model / local HTTP OCR wrapper / custom script
-> write raw payload or document.v1
-> RetainPDF validates document.v1
-> translation/rendering continues.
```

Main flow only reads final ocr/normalized/document.v1.json, does not directly read your provider private JSON.

## When to use

For these cases:

- You have local OCR Models, e.g. PaddleOCR、Marker、MinerU Locally deployed, self-trained layout model.
- You have a local HTTP OCR service, but want to use a wrapper script to integrate with RetainPDF.
- You want to quickly verify a OCR provider, rather than modifying Rust APItranslation, and rendering main workflows.

Unsuitable for these cases.

- provider Required RetainPDF Internal responsible for complexity. submit / poll / download State machine. Better use that first. `remote_command`Stabilize, then built-in. provider。
- Downstream consumes directly. provider Private fields.RetainPDF Unsupported. Convert first. `document.v1`。

## Provider configuration

Configuration file:

```text
backend/config/ocr_providers.json
```

Minimal configuration:

```json
{
  "providers": {
    "my_local_ocr": {
      "display_name": "My Local OCR",
      "kind": "local_command",
      "credential": null,
      "options": {
        "command": {
          "type": "string",
          "default": "python /opt/retainpdf-ocr/my_ocr.py"
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

Select on task submission provider key：

```json
{
  "ocr": {
    "provider": "my_local_ocr"
  }
}
```

command and raw_provider read order:

1. Task request or stage spec provider options.
2. `ocr_providers.json` Default value in.
3. Environment variables RETAIN_LOCAL_OCR_COMMAND / RETAIN_OCR_RAW_PROVIDER.

## Command invocation contract

RetainPDF Will be job Run your command from the root directory:

```text
cwd = RETAIN_OCR_JOB_ROOT
```

Command passed shell Execute, so the configuration can be:

```text
python /opt/retainpdf-ocr/my_ocr.py
```

Alternatively:

```text
/opt/retainpdf-ocr/bin/run_ocr --model local-v1
```

Exit code semantics:

- 0 means OCR command succeeded; RetainPDF continues checking output files.
- Non-zero means OCR stage failed; stderr/stdout will enter task log.

stdout/stderr semantics:

- Outputs human-readable logs.
- Do not write OCR main result to stdout.
- OCR Main result write to file path specified by environment variable.

## Input Environment Variables

Stable environment variables are received when the command executes:

```text
RETAIN_OCR_PROVIDER
RETAIN_OCR_PROVIDER_KIND
RETAIN_OCR_CREDENTIAL
RETAIN_OCR_SOURCE_PDF
RETAIN_OCR_SOURCE_URL
RETAIN_OCR_JOB_ROOT
RETAIN_OCR_SOURCE_DIR
RETAIN_OCR_DIR
RETAIN_OCR_PROVIDER_RESULT_JSON
RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
RETAIN_OCR_NORMALIZATION_REPORT_JSON
RETAIN_OCR_PROVIDER_RAW_DIR
RETAIN_OCR_RAW_PAYLOAD_JSON
RETAIN_OCR_RAW_PROVIDER
```

Common field descriptions:

| Variable | Description |
| --- | --- |
| RETAIN_OCR_SOURCE_PDF | Input PDF local path. Normal local upload tasks always have a value. |
| `RETAIN_OCR_SOURCE_URL` | URL Original at input URL。`local_command` Usually not. |
| RETAIN_OCR_JOB_ROOT | Current job root directory. |
| `RETAIN_OCR_SOURCE_DIR` | Source directory.URL In mode plugin must final PDF Drop here. |
| `RETAIN_OCR_DIR` | OCR Stage directory. |
| `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON` | directly output `document.v1.json` target path. |
| RETAIN_OCR_RAW_PAYLOAD_JSON | Target path for raw payload output. |
| `RETAIN_OCR_RAW_PROVIDER` | raw payload Corresponding adapter Name, e.g. `generic_flat_ocr`。 |
| RETAIN_OCR_PROVIDER_RESULT_JSON | Optional provider result summary |
| `RETAIN_OCR_NORMALIZATION_REPORT_JSON` | Optional normalization report. |
| `RETAIN_OCR_CREDENTIAL` | Parsed backend credentials. Empty if none. |

## Output Method Awrite directly document.v1

If you are willing to generate directly. RetainPDF Unified document structure, just write:

```text
$RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
```

File content must be document.v1.json; detailed fields follow Document Schema description.

Most stable, but highest integration cost. Best for deep integration. OCR provider。

After command succeeds, RetainPDF will:

1. Validate document.v1.json.
2. If not `document.v1.report.json`Auto-generate a minimal report.
3. If no result.json, auto-add a provider summary.
4. let translation/Rendering remains read-only. `document.v1.json`。

## Output mode B: write raw payload

Recommend going first. raw payload mode. Your command writes:

```text
$RETAIN_OCR_RAW_PAYLOAD_JSON
```

Then RetainPDF uses the adapter corresponding to RETAIN_OCR_RAW_PROVIDER to convert to document.v1.json.

Current built-in min adapter Yes:

```text
generic_flat_ocr
```

Fits page. -> block -> bbox + textGeneral OCR Input question

### generic_flat_ocr schema

Minimum structure:

```json
{
  "provider": "generic_flat_ocr",
  "pages": [
    {
      "page": 1,
      "width": 612,
      "height": 792,
      "unit": "pt",
      "blocks": [
        {
          "type": "text",
          "sub_type": "body",
          "bbox": [72, 72, 420, 120],
          "text": "OCR raw text",
          "lines": [],
          "segments": []
        }
      ]
    }
  ]
}
```

Field description:

| Field | Required | Description |
| --- | --- | --- |
| provider | Yes | Fixed to generic_flat_ocr. |
| pages | Yes | Page array. |
| pages[].width / height | Yes | Page dimensions. Recommended in PDF points. |
| pages[].unit | No | Default pt. |
| blocks[].type | No | Default text. Non-text blocks will not enter translation. |
| blocks[].sub_type | No | Default body. Common values: title, heading, abstract, body, footnote, reference_entry. |
| blocks[].bbox | Yes | [x0, y0, x1, y1]; coordinates must be in the same coordinate system as page size. |
| blocks[].text | Yes | OCR text. |
| blocks[].lines | No | Row-level structure. Provide if possible; helps with directories, lists, tables. |
| blocks[].segments | No | Inline fragments. Can provide formulas, styles, or tokens if available. |

`sub_type` Affects default policy:

- `body`、`abstract`、`heading` Entering translation.
- `footnote`、`reference_entry`、`header`、`footer`、`page_number` default not translated as body text.
- If your provider can recognize directories, lists, headings, it should be done in adapter or raw payload; rendering layer must not infer.

## Minimal my_ocr.py example

Below example not represent real OCRShow only plugin path read/write.

```python
import json
import os
from pathlib import Path


def main() -> None:
    source_pdf = Path(os.environ["RETAIN_OCR_SOURCE_PDF"])
    target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
    target.parent.mkdir(parents=True, exist_ok=True)

    # TODO: Invoke local here. OCR Model.
    payload = {
        "provider": "generic_flat_ocr",
        "pages": [
            {
                "page": 1,
                "width": 612,
                "height": 792,
                "unit": "pt",
                "blocks": [
                    {
                        "type": "text",
                        "sub_type": "body",
                        "bbox": [72, 72, 420, 120],
                        "text": f"OCR result from {source_pdf.name}",
                        "lines": [],
                        "segments": [],
                    }
                ],
            }
        ],
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
```

Runtime Configuration:

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /opt/retainpdf-ocr/my_ocr.py"
export RETAIN_OCR_RAW_PROVIDER=generic_flat_ocr
```

## Local copy exists. HTTP OCR Service?

Still recommended. `local_command` wrap in a layer wrapper。RetainPDF You localize faithfully. HTTP API Specify only the appearance. wrapper Input and output.

Example:

```python
import json
import os
from pathlib import Path

import requests


def main() -> None:
    source_pdf = Path(os.environ["RETAIN_OCR_SOURCE_PDF"])
    target = Path(os.environ["RETAIN_OCR_RAW_PAYLOAD_JSON"])
    target.parent.mkdir(parents=True, exist_ok=True)

    with source_pdf.open("rb") as file:
        response = requests.post(
            "http://127.0.0.1:8000/ocr",
            files={"file": (source_pdf.name, file, "application/pdf")},
            timeout=600,
        )
    response.raise_for_status()

# Local HTTP service should directly return generic_flat_ocr; if not, convert here.
    payload = response.json()
    target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
```

This way third parties only need to maintain their own. OCR Services and wrapper, no need to let RetainPDF Understand each service's internals. HTTP API。

## URL Input Precautions

Normal local upload task provides `RETAIN_OCR_SOURCE_PDF`。

If the task comes from URLmaybe only:

```text
RETAIN_OCR_SOURCE_URL
```

The plugin must now use the final source. PDF Download or materialize to:

```text
$RETAIN_OCR_SOURCE_DIR/*.pdf
```

Otherwise, subsequent translation and rendering have no local source. PDFTask fails.

## Failure handling

Plugins must:

- Invalid parameter.OCR Service unavailable, unable to generate output: non-zero exit code. `0`。
- Write diagnostic info to stderr or stdout.
- Do not generate partial JSON then exit 0. JSON Still exits after `0`。
- If exiting with 0, provide one of RETAIN_OCR_NORMALIZED_DOCUMENT_JSON or RETAIN_OCR_RAW_PAYLOAD_JSON.

RetainPDF Follow-up checks:

- Does the output file exist?
- raw payload Whether it can be adapter Identify.
- `document.v1.json` Pass? schema Validate.

## Debugging Checklist

When integrating local OCR, first check these points:

- provider config kind is local_command.
- `command` Can be executed under the backend running user.
- Read input PDF from RETAIN_OCR_SOURCE_PDF; do not hard-code path.
- Write output to RETAIN_OCR_RAW_PAYLOAD_JSON or RETAIN_OCR_NORMALIZED_DOCUMENT_JSON.
- raw payload's provider must match RETAIN_OCR_RAW_PROVIDER.
- bbox Coordinates and Pages `width/height` Use the same unit.
- Page numbers, block orderbbox Don't invert or leave empty.
- Exit non-zero on command failure. `0`Do not silently swallow errors.

## Built-in provider boundaries

Add Local OCR provider No changes needed to:

- Translation module
- Rendering Module
- Rust job runner Main flow

Only when `generic_flat_ocr` cannot express your provider only when outputting, need to add:

```text
backend/scripts/services/document_schema/provider_adapters/<your_provider>/
```

After adding a new adapter, set raw_provider to your adapter name. The main flow still only consumes document.v1.json.
