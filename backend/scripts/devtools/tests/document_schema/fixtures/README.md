# Document Schema Fixtures

Place here `document_schema` Minimum sample for long-term regression use.

Recommended reading order:

1. 先看 `scripts/services/document_schema/README.md`
2. Prepare the minimum fixture in the current directory fixture
3. Then write adapter 和 registry
4. Run last. `regression_check.py`

Primarily responsible for. fixture 规则。
More complete field placement,provider Integration Orderreport Structure description, using `document_schema/README.md` For clarity.

目标：

- 新 OCR provider During integration, fill in the minimum first. raw fixture
- adapter After completion, take this. fixture 登记到 `registry.py`，再由 `regression_check.py` Auto-consume
- 不要先改 translation/rendering Adapt main branch provider 原始 JSON

当前约定：

1. 每个 provider At least one minimum. raw fixture
2. fixture Keep it as small as possible, but ensure reliable triggering. detector
3. fixture Filename recommended with provider 名称
4. Large samples remain citable. `output/...` Real task files inside; prioritize small samples that are commit-ready and retainable long-term.

Recommended minimum coverage:

- detector Identifiable
- adapter Can produce valid `document.v1`
- Include at least 1 页
- 至少包含 1 Text block

当前 fixture：

- `generic_flat_ocr.minimal.json`

## Fixture side Checklist

Integrate new OCR provider When, only care about here. fixture This side:

1. Prepare Minimal raw fixture
   - Place in current directory.
   - Filename with provider 名称
   - Reliably triggered. detector

2. 把 fixture Access `scripts/devtools/tests/document_schema/fixtures/registry.py`
   - `name` Unique
   - `provider` 与 adapter Registration name matches; cite first. `services/document_schema/providers.py` Shared constants in
   - `document_id` Stable and Readable

3. Run `scripts/devtools/tests/document_schema/regression_check.py`
   - 至少确认 detector、adapt、validation、extractor smoke All passed.
