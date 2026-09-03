# OCR Provider API description

This layer specifically describes "external". OCR "How to integrate the service", without coupling with current translation and rendering workflow.

The goal is clear:

- Third-party OCR API Treat as replaceable providernot part of main flow
- Let MinerU and subsequent other OCR API local runs fail; OCR all follow the same integration approach.
- separate 'calling provider APIUnified consumption schemaCompletely separate

## Design boundaries

This layer is responsible for:

- Define OCR provider capability boundary
- Define provider API minimal access abstraction
- Conventions provider How to write the original artifacts to disk.
- Specify how raw payload accesses the document_schema adapter chain

This layer does not handle:

- Not responsible translation.
- Not responsible for PDF rendering.
- Not responsible for Typst
- Unsupported text block policy.
- Not responsible for anything. provider Specific JSON Business Consumption

## Core principles

1. Workflow only accepts unified schema, does not recognize provider raw JSON
   - Main chain OCR Input is always `document.v1.json`
- Provider raw JSON can only stay at provider layer, adapter layer, debug layer

2. provider API what is
   - Responsible for sending files, retrieving results, and persisting to disk.
   - It must not determine translation mode, rendering mode, font, formula protection, or block strategy.

3. raw -> normalized Must explicitly go through adapter
   - Any provider Enter first; return results. `services/document_schema/adapters.py`
   - Cannot bypass directly. `translation/ocr`、`rendering/` Understand provider JSON

4. provider Capabilities are variable; unify. schema The stable contract.
   - provider Interfaces, fields, return formats may change.
   - Main link do not follow these changes.

## Abstract recommendation

If later need to OCR API Truly separate layers. Split into at least the following interface types.

### 1. Provider Capability declaration

Each provider first declares its capability boundaries, for example:

- Required? token
- whether supports URL parsing
- Local file upload supported?
- whether supports batch
- Support callbacks?
- Table support?/Formula Toggle
- Maximum file size
- Page limit
- Supported Input Types
- Default output type

This part is provider metadataMust not be scattered across workflow conditionals.

### 2. Provider Task interface

Unify into the following action types:

- `submit_url_task(...)`
- `submit_file_task(...)`
- `poll_task(...)`
- `download_result(...)`
- `unpack_result(...)`

Note: still only. provider API Semantics, not main flow semantics.

For example:

- submit_* returns provider task id / batch id
- poll_task returns provider current status
- download_result returns zip / markdown / json / html awaiting original artifact.

### 3. Provider Original artifact convention

provider Layer only responsible for organizing raw results into stable disk structure, e.g.:

- `ocr/provider/<provider-name>/...`
- `ocr/unpacked/...`
- `ocr/provider_summary.json`

Do not directly assume at provider layer:

- Must exist. `layout.json`
- Must have full.md
- Is zip
- Must contain tables and formulas

All these should be provider-specific artifactnot the main process prerequisite.

### 4. Raw -> Schema Adaptation Entry

provider Once the layer artifact is written to disk, the next step does one thing only:

- Call the document_schema adapter to normalize the raw payload.
  - `document.v1.json`
  - `document.v1.report.json`

Up to here provider Responsibilities end here.

## MinerU As a provider Conclusion

Based on current MinerU API Document text missing. Provide points or full source.

1. MinerU There are two types API
   - Precise Parsing API：tokenAsync table support/Formulas, multi-format output, batch processing.
- Agent lightweight API: no login, async, stricter limits, only Markdown

2. these two categories API None should directly couple to the main flow.
   - They are just different. provider transport / result shape
- Not main flow OCR contract

3. MinerU Only two types belong in the main path.
   - Source artifact file
- Output document.v1 via adapter

4. Uncouple workflow from content.
- MinerU's task state literal
- MinerU's layout.json / content_list_v2.json field details
- MinerU's zip internal file naming
- MinerU specific upload method, batch semantics, callback details
   - MinerU Model version names directly participate in translation./Render Decision

## Placement suggestions in current project

In the current code, it can be understood as follows:

- `services/ocr_provider/provider_pipeline.py`
This is the provider-backed full-process stable entry point; scripts, tests, compatibility patches are all bounded by it.
- `services/ocr_provider/paddle_api.py`
This is Paddle transport/polling/result download
- `services/ocr_provider/paddle_markdown.py`
This is Paddle Markdown saving image outputs to disk.
- `services/ocr_provider/paddle_normalize.py`
This is Paddle normalized document geometric correction etc. pure implementation.
- `services/mineru/`
This is MinerU provider specific implementation, not "OCR Main Entry",
- `services/document_schema/`
This is OCR unified contract layer
- `runtime/pipeline/`
  Business orchestration layer.

If connecting to others later. OCR APISuggest evolving to the following relationship:

- `services/ocr_provider/`
Only place provider integration spec and shared abstractions.
- `services/mineru/`
As a specific implementation of ocr_provider
- `services/<other_ocr>/`
Other provider specific implementations
- `services/document_schema/`
  continues as the unified normalized contract

That is:

- provider Replaceable
- adapter Extensible
- workflow No need understand. provider Difference

## Recommended integration steps

When adding a new OCR provider, recommended order:

1. Write first. provider Capabilities
2. Write more provider API Calling Layer
3. Persist provider original artifacts stably to disk.
4. Write document_schema adapter
5. fill fixture and regression
6. Entry permitted only at the end. translation/rendering main branch

If before step 4 you let provider raw JSON enter the main flow, further coupling is guaranteed.

## Correct MinerU Engineering conclusions for documentation

From current MinerU API Document review, the most worthwhile to absorb are these abstract pieces of information:

- Async task model.
- It distinguishes. URL Submit and File Upload
- It distinguishes between batch and single-file.
- Has provider Own State Machine
- Its raw output is not limited to one type.
- Capability ceiling and limitations explicit.

These should be entered. provider Layer design.

Exclude from main flow:

- Specific HTTP paths
- Some specific JSON field name
- Some specific zip internal file name
- Some specific provider, e.g., DeepSeek

## Current suggestions

Do not include in the short term. `services/mineru/` continue expanding into the "default" OCR Platform layer.

A more stable approach:

- explicitly downgrade it to the MinerU provider.
- Add this one. `ocr_provider/README.md` General convention.
- subsequent new OCR API When, first align with this convention, then decide the directory and adapter

Switch this way later. OCR provider, no need to split translation/render mainline again.

## Current implementation constraints

Current codebase already sufficient. Stop refactoring. `ocr_provider/` Directory maintenance rules below:

- provider_pipeline.py is responsible for stage/provider distribution and stable compatibility surface.
- drivers.py is responsible for Python provider registry; add provider and park it here; do not merge the dispatch logic back into the main flow.
- types.py defines provider driver stable input/output contract; OcrProviderResult.artifact_manifest is the provider artifact boundary.
- On the Rust API side, provider artifact path backend/rust_api/src/ocr_provider/catalog.rs artifact layout note: task orchestration must not write provider filenames inside the workspace.
- On the Rust API side, provider transport is distributed by the transport registry in backend/rust_api/src/job_runner/ocr_flow/provider_transport.rs; for new built-in providers, register the transport handler first.
- Prioritize sinking new pure implementations into independent modules; do not directly cram back. `provider_pipeline.py`
- If tests require. monkeypatch，patch Point remains at `provider_pipeline.py`
- `services/ocr_provider/__init__.py` Must explicitly export. `provider_pipeline`
- `paddle_api.py` No action taken. normalized schema
- paddle_markdown.py only handles Markdown/image artifacts; no translation or rendering
- paddle_normalize.py only handles normalized document; leaves geometric correction untouched, provider transport.
- `local_command_driver.py` Local. OCR Minimal model entry point; ignores implementation, validates only persistence contract.
- `services/document_schema/adapters.py` Do only adapter registryUnderstood. import `services/mineru/*`；MinerU Go `services/document_schema/provider_adapters/mineru/`
- Paddle Default model and alias Place in `backend/config/ocr_providers.json`, do not in Python/Rust Hardcoded version number.

These constraints have been applied:

- `backend/scripts/devtools/check_pipeline_architecture.py`

In other words, if later someone... `ocr_provider` re-connect to translation/Rendering layer, or change stable entry to implicit export./Deep direct connection; local architecture check fails immediately.

## Local OCR Integration method

If others want to connect to their own local. OCR Model, prioritize configuration-driven approach. `local_command` provider, do not modify translation or rendering code.

See the complete external integration documentation:

```text
doc/api/03-OCR/04-local-commandPlugin.md
```

The core design of this layer is: local OCR is a 'command line API'. RetainPDF launches commands and passes input via environment variables and output paths; the local OCR command handles reading PDF, writing out raw payload or document.v1.json.

Runtime Settings:

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /path/to/my_ocr.py"
```

Then on task submit, let OCR provider be local; local commands receive these environment variables:

```text
RETAIN_OCR_SOURCE_PDF
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

Minimum success criteria.

- Read RETAIN_OCR_SOURCE_PDF
- Write `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON`, the content is `document.v1.json`
- or write RETAIN_OCR_RAW_PAYLOAD_JSON, letting RetainPDF generate unified document.v1.json via the document_schema adapter.
- Exit code on success: `0`exit non-zero on failure `0`

Optional:

- Write RETAIN_OCR_PROVIDER_RESULT_JSON to save local OCR raw results
- Write RETAIN_OCR_NORMALIZATION_REPORT_JSON to save your diagnostic report.

If local command written directly. `document.v1.json`，driver Will add a minimal one. report/result, and validate `document.v1.json`Skip.reader API All consume only unified. schema。

If local. OCR can only output custom raw JSONSource text missing. Provide text to translate. `document.v1.json`Recommended to go. raw artifact Mode:

1. First, stably land raw JSON to RETAIN_OCR_RAW_PAYLOAD_JSON
2. Add new adapter in services/document_schema/provider_adapters/
3. adapter output `document.v1.json`
4. Specify adapter name via RETAIN_OCR_RAW_PROVIDER
5. To become a built-in provider, then register the provider driver in services/ocr_provider/drivers.py

Minimum raw payload Examples can use built-in first. `generic_flat_ocr` adapter：

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /path/to/my_ocr.py"
export RETAIN_OCR_RAW_PROVIDER=generic_flat_ocr
```

External commands: write structure below. `RETAIN_OCR_RAW_PAYLOAD_JSON`：

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

If you already have a local HTTP OCR service, do not let RetainPDF be directly coupled to the service's private API. Recommend writing a wrapper command: read RETAIN_OCR_SOURCE_PDF, locally request the HTTP service, convert the return result to generic_flat_ocr or document.v1, then write to the agreed path.

## Paddle Model configuration

Paddle Do not hardcode model version in the call layer. Default model and alias Unified from:

```text
backend/config/ocr_providers.json
```

Current default:

```text
PaddleOCR-VL-1.6
```

Overridable via environment variables:

```bash
export RETAIN_OCR_PROVIDER_CONFIG=/path/to/ocr_providers.json
export RETAIN_PADDLE_DEFAULT_MODEL=PaddleOCR-VL-1.6
```

Rust API Also supports:

```bash
export RUST_API_OCR_PROVIDER_CONFIG=/path/to/ocr_providers.json
export RUST_API_PADDLE_DEFAULT_MODEL=PaddleOCR-VL-1.6
```

## Provider Options / Credential Spec / Dynamic discovery

OCR provider All visible contracts are uniformly placed at:

```text
backend/config/ocr_providers.json
```

Frontend and external integrators do not hard-code "some". provider "Which fields need to be filled in", but read:

```http
GET /api/v1/providers/ocr
```

Each returned provider All include:

- key is used when submitting a task; provider name.
- `display_name`Display Name
- provider_kind: remote, local_command, or remote_command
- `credential`Credential fields and environment variable conventions; local. provider Can be `null`
- `options`：provider Parameter definitions, including `type/default/env/aliases/choices/required`
- `capabilities`Supported? URLLocal file pollingbundleformula/Table Toggle
- `artifact_layout`：provider Stable disk location for the original artifact.

Typical response structure:

```json
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
  }
}
```

If you want to add a local... OCR provider, no need to modify translation/Main rendering process. First, add to configuration:

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
          "default": "python /path/to/my_ocr.py"
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

To add a remote OCR provideralso prioritize `remote_command`, do not first third-party submit/poll/download Write state machine into Rust Main flow. Config example:

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

Python provider registry dynamically discovers providers with kind=local_command|remote_command, and uses the same command driver to execute. command/raw_provider read order:

1. stage spec Or in run parameters. provider options
2. `RETAIN_LOCAL_OCR_COMMAND` / `RETAIN_OCR_RAW_PROVIDER`

command provider Will receive these stable environment variables:

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

`remote_command` Key contract:

- Plugin commands handle third-party API submit/poll/download/retry themselves.
- If input comes from source.file_url, the plugin must write the final source PDF to RETAIN_OCR_SOURCE_DIR.
- Plugin can be written directly. `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON`。
- You can also write plugins to RETAIN_OCR_RAW_PAYLOAD_JSON, and then the corresponding adapter via raw_provider converts it to document.v1.json.
- Credentials parsed by backend first. `ocr.credential_ref` Write after `RETAIN_OCR_CREDENTIAL`Also via configuration. `credential.env` Have the plugin read its own environment variables.
- The main workflow only consumes document.v1.json; it does not understand the remote service's own state machine.
