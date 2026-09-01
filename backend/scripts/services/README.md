# Services description

`scripts/services/` Concrete capability implementation layer.

Place the actual work module here, not orchestration:

- `ocr_provider/`
  OCR provider API Independent conventions for the access layer. Only "third-party" is defined here. OCR "How to connect the service", not... provider API Details coupled to translation./Rendering workflow.
- `document_schema/`
  Unify intermediate document structure version definition.adapter registry、defaults Closeschema Validation and normalization report。
- `mineru/`
MinerU provider implementation: submit, poll, download, unpack, organize task artifacts.
- `pipeline_shared/`
provider/translate/render stage protocol shared by main branch summary, unified pipeline_events.jsonl event stream and JSON IO not bound to any single provider.
- `translation/`
  OCR Parse, translate orchestration metadata, policy filter.LLM Call, backfill results.
- `rendering/`
  PDF Erase, Background Processing,Typst Generation, formula formatting, final rendering, and compression.

Design principles:

- `services/*` responsible for completing single capabilities
- `ocr_provider/` Define only provider Access agreement, no specific liability. provider implementation
- document_schema/ defines unified middleware layer; does not carry provider details
- OCR provider raw JSON must pass through document_schema/adapters.py first to convert to document.v1
- Need more context. What to troubleshoot? When converting raw -> normalized, prioritize checking document.v1.report.json or validate_document_schema.py --adapt
- If only consuming. provider / defaults / validation Summary first `document_schema/reporting.py`
- mineru/ is a provider implementation, not OCR overall workflow itself.
- `pipeline_shared/` It is a neutral shared layer and should not be placed there. provider Private logic
- `translation/ocr` Main thread read first normalized documentrather than directly depending on a specific OCR provider Original JSON
- `runtime/pipeline` Only responsible for orchestrating these capabilities.
- Top-level entry prioritizes dependency. `runtime/pipeline`Do not directly stitch processes across services.
- Common configs and shared tools continue sinking down to `foundation/`

## New OCR provider shortest path

New provider integration: recommended shortest path:

1. Read First `ocr_provider/README.md`
2. Read again `document_schema/README.md`
3. Prepare minimal raw fixture
4. Write provider API access layer and adapter
5. Add fixture to devtools/tests/document_schema/fixtures/registry.py
6. Run devtools/tests/document_schema/regression_check.py

Only after this chain runs successfully,provider Should only enter. translation/rendering Main branch.

## Collaboration rules

Now split owners by module; boundaries must follow protocol:

- OCR / provider Owner primarily maintains. `ocr_provider/`、`mineru/`、`document_schema/`
- Maintained primarily by translation manager. `translation/`
- Rendering lead maintains. `rendering/`
- Orchestration owner primarily maintains. `runtime/pipeline/`

Default principles:

- Each owner resolves issues within their own module first; do not propagate temporary special-case logic to other modules.
- `document.v1.json`、`translation-manifest.json`、render-only Input protocol is a stable handoff point. No unilateral changes.
- If the handover agreement must be changed, update upstream and downstream simultaneously. READMEEntry point handle compatibility logic test
- translation / rendering Main branch forbids re-dependency. provider raw JSON
- pipeline Orchestration only, no ingestion. provider Special cases, translation details, or rendering patches.
