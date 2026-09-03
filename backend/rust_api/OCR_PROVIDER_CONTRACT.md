# OCR Provider Contract

This document answers only one question:

**In `rust_api`, what the OCR provider layer is and isn't responsible for.**

Related documents:

- Architecture boundaries:
  [`RUST_API_ARCHITECTURE.md`](/home/wxyhgk/tmp/Code/backend/rust_api/RUST_API_ARCHITECTURE.md)
- Running main chain:
  [`CURRENT_API_MAP.md`](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)
- stage runtime contract:
  [`STAGE_EXECUTION_CONTRACT.md`](/home/wxyhgk/tmp/Code/backend/rust_api/STAGE_EXECUTION_CONTRACT.md)
- Paddle OCR API Summary:
  [`src/ocr_provider/paddle/API_SUMMARY.md`](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle/API_SUMMARY.md)

## 1. Goal

`ocr_provider` The goal of this layer is not to run completely. OCR process, but rather provide:

- provider Identification
- provider Capability Statement
- provider transport client
- provider Status Mapping
- provider Error Classification

That is:

- This provider DeepSeek
- It supports what
- It returns what status mean.
- It fail how classify

## 2. Current directory

- [src/ocr_provider/mod.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/mod.rs)
- [src/ocr_provider/types.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/types.rs)
- [src/ocr_provider/catalog.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/catalog.rs)
- [src/ocr_provider/mineru](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/mineru)
- [src/ocr_provider/paddle](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/paddle)

## 3. Division of labor

### 3.1 `types.rs`

Responsible for provider shared data structures:

- `OcrProviderKind`
- `OcrProviderCapabilities`
- `OcrProviderDiagnostics`
- `OcrTaskStatus`
- `OcrProviderErrorInfo`

Rules:

- Shared content here. contract
- No provider Exclusive transport Logic

### 3.2 `catalog.rs`

Responsible for provider metadata registration:

- `provider_definition`
- `provider_capabilities`
- `is_supported_provider`
- `ensure_provider_diagnostics`

Rule:

- Add provider Register here first.
- `capabilities` The only aggregation point must be here.
- `diagnostics` Do not scatter initialization logic across runner Everywhere

### 3.3 `<provider>/client.rs`

Responsible for provider communication:

- Construct Request
- Call External API
- Parse response

Not responsible.

- job Lifecycle
- Route Return
- translation/render Decision

### 3.4 `<provider>/status.rs`

Responsible for provider mapping from original state to unified state.

Example:

- provider raw state -> `OcrTaskState`
- provider raw message -> stage/detail

### 3.5 `<provider>/errors.rs`

Responsible for provider error to unified error classification mapping.

For example:

- invalid token
- expired token
- upload failed
- poll timeout

## 4. Dependency direction

Allow:

```text
job_runner -> ocr_provider
ocr_provider/catalog -> ocr_provider/<provider>
ocr_provider/<provider> -> ocr_provider/types
```

Prohibited:

```text
ocr_provider -> routes
ocr_provider -> services/jobs/presentation
ocr_provider -> translation/render logic
```

## 5. Current runtime conventions

`job_runner` Side now only consumes through these unified entry points. provider Metadata:

- `parse_provider_kind`
- `require_supported_provider`
- `provider_definition`
- `provider_capabilities`
- `ensure_provider_diagnostics`

Especially:

- `OcrProviderDiagnostics` Do not manually write initialization in multiple modules.
- Currently unified to. `ensure_provider_diagnostics`

## 6. Add provider Minimal steps

If adding a third one later provider, the minimum steps should be:

1. New `src/ocr_provider/<provider>/`
2. Implement:
   - `client.rs`
   - `status.rs`
   - `errors.rs`
3. in `catalog.rs` Register:
   - `kind`
   - `key`
   - `capabilities`
4. In `mod.rs` expose provider module
5. In `job_runner/ocr_flow` integrate transport dispatch

Should not do:

- Not in. `routes` Riga provider Special case.
- Do not add provider special cases in `services/jobs/facade`
- Do not add provider initialization logic in `process_runner`

## 6.1 Boundary with `job_runner/ocr_flow`

`ocr_provider` and `job_runner/ocr_flow` division of labor is as follows:

- `ocr_provider`
Responsible for provider client status mapping, error classification, capability declaration
- `job_runner/ocr_flow`
Responsible for OCR subtask runtime orchestration, workspace, provider raw/result flush, normalize interface

To further elaborate:

- `ocr_flow/mod.rs`
Is the unique OCR subprocess orchestrator
- provider client Structure, Local/Remote transport Branch selection
  must also be closed at `ocr_flow/mod.rs`
- `ocr_flow/*` Other submodules cannot re-grow into a second one orchestrator
- provider raw token Understanding should be confined to specialized. helper
For example Paddle Markdown artifact helper

## 7. Boundary Redlines

### Red line 1

provider Layer incomplete. job orchestration。

### Red line 2

provider Layer does not determine translation strategy.

### Red line 3

provider Layer returns nothing. HTTP view model。

### Red line 4

provider Capability declaration must have a single registration point, not scattered. `match kind`.

Current registration endpoint:

- [catalog.rs](/home/wxyhgk/tmp/Code/backend/rust_api/src/ocr_provider/catalog.rs)
