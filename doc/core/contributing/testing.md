# Test contribution guidelines

Test contribution and code contribution are equally important. Professional testers do not need to fully understand internal implementation to contribute high-value work directly.

## Contribute code, docs, or bug reports.

- Public or anonymized PDF Sample, corresponding expected result, page number,bboxScreenshot capture job_id。
- OCR Normalization, translation, formula protection, rendering, download,reader、library、resume Regression test cases.
- Large-sample performance benchmarks, e.g., 100-page, 500-page, 1000-page PDF stage durations, memory usage, output sizes.
- End-to-end acceptance checklist, e.g., desktop first launch,Docker Upgrade, Retry on disconnect,token Error, Task Cancel, Re-render, Batch Delete.
- Manual test report: environment, version, reproduction steps, expected results, actual results, attachments.
- Automated test script or fixturebut must ensure no private content is included. token, real user files, or non-public content.

## Test issue suggested format

```md
## Environment

- RetainPDF version:
- Run mode: Desktop / Docker / Local Development
- System and browser:
- OCR provider：
- Model provider:

## Sample

- Public:
- Pages:
- Related pages / bbox：
- job_id：

## Steps

1. ...
2. ...

## Expected result

...

## Actual result

...

## Attachment

- Screenshot / Desensitize PDF / Logs / Event Stream Fragment
```

## Test PR suggestions

- Keep fixture minimal but usable: 1-3 pages; do not submit entire book for reproduction.
- Large Files, Batch PDF、benchmark Default output location `experiments/` or external links; only small samples explicitly requiring automated testing are committed to the repository.
- When adding tests, state what they protect. bugModule user flow.
- For performance testing, clearly specify the machine environment, sample page count, command, old duration, new duration, and allowable fluctuation range.
- Visual/Rendering issues. Include page numbers if possible.bboxScreenshot and expected behavior missing. "Looks wrong" fails regression.

## Common test entry points

Rust API：

```bash
cargo test --manifest-path backend/rust_api/Cargo.toml
```

Python：

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema -q
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Frontend & desktop:

```bash
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix desktop run verify-frontend-sync
```

npm --prefix frontend test uses Node native test runner, covers task progress status reshaping pure functions first. No browser backend dependency.

Frontend end-to-end state smoke will actually submit tasks; typically requires local Rust API, OCR token, model key, and sample PDF; run when conditions met:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```
