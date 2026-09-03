# 0001 Use document.v1 as OCR intermediate representation to downstream

## Background

RetainPDF supports PaddleOCR, MinerU, and any future OCR providers. Different provider raw JSON fields, file structure, and semantic tags all differ. If translation and rendering read provider raw payload directly, each subsequent provider's private fields propagate to the entire call chain.

## Decision

OCR Produce unified output after phase completion. `ocr/normalized/document.v1.json`。

Main translation and rendering pipeline consume-only. `document.v1` Stable field, not directly consumed. provider raw JSON。

provider raw files are only allowed to remain in provider、adapterDebug trace layer.

## Consequences

- New OCR provider must first write an adapter to convert raw payload to document.v1.
- Translation and rendering cannot special-case read raw fields for a certain provider.
- If document.v1 lacks expressive capability, upgrade the schema rather than letting downstream bypass the schema.

## Alternatives

- Make translation and rendering directly compatible with each other. Keep provider raw JSON separate to avoid polluting the main pipeline with provider-specific fields.
- Maintain a separate full pipeline per provider, duplicating translation, rendering, and diagnostic implementations.
