# Paddle OCR Integration docs

This is RetainPDF's own OCR adapter description, not Paddle official documentation.
If you want to change how Paddle raw JSON gets into document.v1, look here.

This documentation serves one purpose:

- Stably converge the original Paddle OCR returned result to normalized_document_v1

Do not write this as a translation rules document, nor include rendering strategies here.

## Integration boundary

Students adapting Paddle OCR are only responsible for:

1. Understand Paddle's raw API and JSON structure
2. Implement provider detection and the adapter
3. Map Paddle private fields to document.v1
4. Add fixtures, regression testing, and documentation

Not responsible:

1. Skip translation layer. `services/translation/*`
2. Render layer unchanged. `services/rendering/*`
3. Absent `runtime/pipeline/*` write in Paddle Private special case
4. Downstream read access denied. Paddle raw JSON

## Current entry point

- provider Sign up:
  `backend/scripts/services/document_schema/adapters.py`
- provider Constants:
  `backend/scripts/services/document_schema/providers.py`
- Paddle adapter entry point:
  `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`
- Paddle page reader：
  `backend/scripts/services/document_schema/provider_adapters/paddle/page_reader.py`
- Paddle block reader：
  `backend/scripts/services/document_schema/provider_adapters/paddle/block_reader.py`
- General Contract Notes
  `backend/scripts/services/document_schema/README.md`

## Reading Order

1. [00_overview.md](./00_overview.md)
2. [01_response_shape.md](./01_response_shape.md)
3. [02_field_mapping.md](./02_field_mapping.md)
4. [03_semantics_rules.md](./03_semantics_rules.md)
5. [04_continuation_hint.md](./04_continuation_hint.md)
6. [05_adapter_checklist.md](./05_adapter_checklist.md)
7. [06_job_artifact_boundary.md](./06_job_artifact_boundary.md)
8. [official/README.md](./official/README.md)

## Integration principles

1. Paddle private fields are only allowed to remain in the adapter layer and trace layer.
2. Downstream main chain only consumes. `document.v1.json`。
3. If Paddle has identified consecutive paragraph groups, write continuation_hint; do not leak group_id private fields directly to translation.
4. Ensure first. schema Correct. Then semantic enhancement; don't pile rules upfront.
5. `provider raw -> normalized_document -> artifact export -> download API` Four-layer boundary. Do not mix.
