# Rust Artifact Boundary

This document answers only one question:

Rust API How to view now `provider raw / normalized / published artifact / download API` These four boundary layers.

## 1. Four‑layer boundary

```text
provider raw
  -> normalized
  -> published artifact
  -> download API
```

Four layers' responsibilities must remain distinct and stable.

## 2. Provider Raw

This layer is the provider's own original result or original directory snapshot.

Rust The side only treats it as 'registerable, downloadable, debuggable'. provider Artifacts are not a unified document contract.

Current typical key：

- `provider_result_json`
- `provider_bundle_zip`
- `provider_raw_dir`
- `layout_json`

This layer allows:

- Keep the provider's original structure
- For troubleshooting and rollback reference.
- As input source before normalization

This layer does not allow:

- Allow the download API to commit to provider private field semantics
- Let artifact registry understand provider fields like layoutParsingResults
- Let downstream translation/rendering directly depend on the provider raw structure

## 3. Normalized

This layer is the formal handover deliverable from the OCR phase to downstream.

Current official file:

- `normalized_document_json`
- `normalization_report_json`

Rust Side response: treat it as:

- The stable structural boundary from OCR to translation/rendering.
- Official documentation for external download.

The Rust side should not merge provider raw and normalized into one concept.

Especially:

- `normalized-document` Download only corresponds `normalized_document_json`
- The normalization-report download endpoint corresponds only to normalization_report_json

## 4. Published Artifact

This layer is the Rust API's artifact registry / published artifact scope.

Responsibility:

- Set stable for task directory files. `artifact_key`
- Unified Generation manifest
- Provide unified resource path.
- Handle bundle export compositions

It is not responsible for:

- Understanding provider raw internal fields
- Defining normalize semantics
- Infer document semantics: text, structure, formulas, etc.

In other words:

- `provider raw` Original Input Snapshot
- `normalized` Unified Document Contract
- `published artifact` Yes.Rust Registration layer for externally publishing these files.

Not one layer.

## 5. Download API

The download API is the outermost HTTP exposure layer.

It promises only two things:

- Stable Resource Download
- Unified artifact download by artifact_key

It does not promise:

- provider Private field structure
- job Physical directory layout
- Provider raw internal JSON semantics

Therefore:

- /normalized-document exposes the normalized boundary
- /normalization-report exposes the normalized auxiliary artifact
- /artifacts/{artifact_key} exposes the published artifact boundary
- provider raw Only when explicitly downloading the corresponding. artifact key Only then exposed as 'raw file', not 'unified semantic interface'.

## 6. Current Rust side landing points

Rust The files most directly relevant to these four layers are:

- `backend/rust_api/src/storage_paths.rs`
- `backend/rust_api/src/services/artifacts/mod.rs`
- `backend/rust_api/src/routes/jobs/download.rs`

The boundary conventions for these three places are:

- `storage_paths.rs`
Responsible for path conventions, artifact keys, file parsing, and published artifact discovery
- `services/artifacts/*`
Responsible for artifact registry, bundle building, and resource path mapping
- `routes/jobs/download.rs`
Responsible for HTTP download entry adaptation

None of them should begin to understand. provider raw internal fields.

## 7. One-sentence validation rule

If a change requires Rust Download layer. provider raw JSON Field name typically already out of bounds.

The correct direction is usually:

- provider Changes, Edit adapter / normalize
- published artifact Change, modify `storage_paths.rs` / `services/artifacts/*`
- HTTP Expose changes, modify download. route / facade
