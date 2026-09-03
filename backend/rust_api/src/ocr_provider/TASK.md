# MinerU Provider Rust Refactor task.

Goal:

- Establish independent internal OCR provider API layer in `rust_api`.
- Implement first. `MinerU` this provider
- Do not keep MinerU API details coupled to current translation/rendering workflow.
- Consolidate provider status, errors, and original artifact information into stable Rust structures for easy troubleshooting and future OCR API integration.

## Scope

This time, only change `rust_api`。

Allow changes:

- `rust_api/src/**`
- Add `rust_api/api.md` / `rust_api/API_SPEC.md` if needed.

Do not change:

- Python Main Story
- Python Main Render Thread
- `document_schema` Main contract

## Target directory

Add standalone provider layer in `rust_api/src/`, suggested form:

- `ocr_provider/mod.rs`
- `ocr_provider/types.rs`
- `ocr_provider/mineru/mod.rs`
- `ocr_provider/mineru/client.rs`
- `ocr_provider/mineru/models.rs`
- `ocr_provider/mineru/status.rs`
- `ocr_provider/mineru/errors.rs`

Can be fine-tuned based on implementation, but requirements:

- MinerU API Put code in separate folder.
- Independent state mapping
- Error Mapping Independent
- Do not pile MinerU HTTP calls in `routes/` or `job_runner.rs`.

## Mandatory objectives

### 1. Definition OCR provider Layer base type

Need at least these types:

- `OcrProviderKind`
- `OcrTaskState`
- `OcrTaskHandle`
- `OcrTaskStatus`
- `OcrArtifactSet`
- `OcrProviderCapabilities`

Requirements:

- `OcrTaskState` Internal unified state; not exposed directly. MinerU Original state literal
- but `OcrTaskStatus` Keep. provider Original state field for troubleshooting.

Suggested unified status includes at least:

- `Queued`
- `WaitingUpload`
- `Running`
- `Converting`
- `Succeeded`
- `Failed`
- `Unknown`

### 2. Implement MinerU Original state -> Internal state mapping

Cover README States already explicitly present in:

- `waiting-file`
- `pending`
- `running`
- `converting`
- `done`
- `failed`

Requirements:

- Preserve original status string.
- Also provide the internal unified state.
- provide human‑readable stage/detail Copy Generator

### 3. Implement MinerU original error -> internal error classification

Minimum: must handle:

- HTTP State error
- Authorization error
- Upload link request failed.
- Upload failed.
- Polling timeout
- provider returned failed
- Result download failed
- Failed to unpack result.
- provider Response struct missing field.

Requirements:

- Error type should not be just a string.
- must retain provider original message / code / trace_id and other context
- To facilitate API Layer returns clear error directly.

### 4. Extract MinerU API calls into independent client

At least organize:

- Request upload link
- Upload file
- Query batch/task status
- Download result

Requirements:

- `job_runner.rs` no longer directly handles MinerU API semantics.
- Routing layer: receive requests and return responses only.
- provider client handles HTTP calls and response parsing.

### 5. Output status and raw info for debugging.

This is the key point; we cannot just make it 'work'.

At least have:

- provider Original state
- provider task_id / batch_id
- trace_id
- Original error code / Error
- full_zip_url availability
- Upload link request stage: status "pending". Upload stage: status "uploading". Polling stage: status "processing".

If appropriate, attach to:

- job extensions artifacts / diagnostics fields
- Or add new provider diagnostics structure

Requirements:

- Frontend and troubleshooting APIs can consume directly.
- Avoid relying on long logs for future troubleshooting.

### 6. Add minimal test.

At least supplement:

- State Mapping Test
- Error Mapping Test
- Critical Response Parsing Test

If time permits, add:

- provider Status copy test

## Non-goal.

This time, do not do:

- Don't change Python `services/mineru/`
- Do not change `document_schema`
- Don't move entire workflow. Rust
- Do not start integrating a second OCR provider

## Engineering principles

- This is just provider API Layer, not business workflow layer.
- MinerU is a provider Implementation, not system master contract.
- Other follow-ups OCR API Should also be able to reuse this layer's abstraction
- You are not just writing "MinerU "Support", you are writing "multi"? OCR provider First version skeleton

## Delivery requirements

After completion, provide:

1. Newly added/Which files were modified?
2. Current provider What are the stable types of layers?
3. What is covered? MinerU status
4. Which error categories are covered?
5. Which tests were run? / `cargo check`
