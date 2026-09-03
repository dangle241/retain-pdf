# 05 Adapter Checklist

## Task definition

Assign one person to adapt. Paddle OCR If applicable, it is recommended to deliver directly as follows:

### Input

- Paddle OCR raw JSON
- Minimum 1 fixture
- At least one relatively complete. fixture

### Output

- Registerable Paddle adapter
- document.v1 output
- Corresponding documentation.
- Corresponding Test

## File scope

Allow modification:

- `doc/core/paddle_ocr_api/*`
- `backend/scripts/services/document_schema/provider_adapters/paddle/*`
- `backend/scripts/services/document_schema/adapters.py`
- `backend/scripts/services/document_schema/providers.py`
- `backend/scripts/devtools/tests/document_schema/fixtures/*`
- `backend/scripts/devtools/tests/document_schema/regression_check.py`

Do not modify:

- `backend/scripts/services/translation/*`
- `backend/scripts/services/rendering/*`
- `backend/scripts/runtime/pipeline/*`

Exceptions:

- Only when the main contract genuinely needs new stable fields is proposal first, then modification permitted. `document_schema`

## Integration order

1. Confirm Paddle Raw Response Format
2. Sort out the top‑level/page‑level/block‑level fields
3. Specify field placement.
4. Implement the detector
5. Implement the adapter
6. Implement continuation_hint mapping
7. Add fixtures
8. Run regression tests.
9. Update documentation.

## Acceptance command

```bash
PYTHONPATH=backend/scripts python backend/scripts/devtools/tests/document_schema/regression_check.py
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema -q
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/translation -q
```

## Required fields

- provider Check stability
- Whether document.v1 passes schema validation
- `source.provider` Thiếu ngữ cảnh. Cần đoạn văn gốc cần kiểm tra. Gửi lại. `paddle`
- `type/sub_type/tags/derived` Compliant with current contract?
- `metadata/source` whether necessary trace is retained trace
- `continuation_hint` Write only when reliable.
- `skip_translation` Skip only that block?

## Delivery Instructions Template

Adapter submitter must at least state:

1. which Paddle API format is supported Paddle API return format
2. which fixtures used fixture
3. which field mappings have been added or modified
4. Which Paddle Field intentionally left unconnected.
5. whether duplicate bboxlogs have been reintroduced `continuation_hint`
6. Test Commands and Results
