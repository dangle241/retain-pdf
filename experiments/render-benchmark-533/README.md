# RetainPDF 533 Page render benchmark.

This directory makes real job `20260514183142-dec42e` Abstract into reproducible large document rendering. benchmark。

It is not a toy problem. Samples are real. 533 Science Books PDF, contains body text, headings, footnotes, figure captions, inline formulas,
Display formula, complex PDF background, Typst overlay, and PDF merge this. benchmark used to measure real document translation.
Render algorithms, not isolated function performance.

## What to optimize

- Typography: fonts, line spacing, bbox visual density; normal text/headings/footnotes/caption strategy
- Typst source builder: generate .typ from translation JSON, speed and structure
- Typst compileFixed `.typ` Compile time on input
- source prepare：bbox text stripPreheat, Background PDF Ready
- PDF overlay：overlay merge Save
- end-to-end render-only Performance

## Current baseline

On the current development machine,warm benchmark Verified:

```text
case: quantum_chem_533
pages: 533
render elapsed: 20.66s
overlay diagnostics total: 18.94s
payload prepare: 3.08s
Typst source prepare: 7.36s
Typst compile: 6.18s
PDF merge: 2.13s
source cleanup: 0.00s
```

Separately compiled and exported. Typst case：

```text
Typst compile only: 6.28s
```

These numbers are not final targets; they are reference baselines for current code and machine.

## One-minute flow

If local source already exists. job：

```bash
python3 experiments/render-benchmark-533/scripts/materialize.py --overwrite
python3 experiments/render-benchmark-533/scripts/check_env.py
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py --run-id my-run --overwrite
```

View results:

```bash
cat experiments/render-benchmark-533/runs/my-run/report.json
```

Export and test separately. Typst：

```bash
python3 experiments/render-benchmark-533/scripts/export_typst_case.py --run-id my-run --overwrite
python3 experiments/render-benchmark-533/scripts/compile_typst_case.py --typst-case my-run --run-id compile-1 --overwrite
```

## Data requirements

Only cloning the code cannot run this directly. 533-page benchmark.

Reason: benchmark Rely on truth. PDF、OCR JSONTranslate JSON and preheating products. These data are large in size and raw.
PDF May involve distribution licensing, so by default not directly placed in the code repository.

People who can run must meet one of the following conditions:

1. Local source exists. job：

   ```text
   data/jobs/20260514183142-dec42e/
   ```

2. Or get benchmark Extract the data package to:

   ```text
   experiments/render-benchmark-533/case-data/quantum_chem_533/job/
   ```

Source job main directories used:

```text
source/
translated/
ocr/normalized/
specs/
artifacts/render_prewarm/
```

Among them, translated/ is about 54MB, ocr/normalized/ about 87MB, source/ about 10MB,
artifacts/render_prewarm/ about 11MB; complete source job will be larger.

## Environment dependencies

Recommended environment:

- Linux x86_64
- Python 3.10+
- RetainPDF Repository source code
- Backend Python dependencies installed.
- Typst CLI executable
- PyMuPDF / `fitz` available import
- Available Chinese fonts, current default. `Source Han Serif SC`

Quick check:

```bash
python3 experiments/render-benchmark-533/scripts/check_env.py
```

Current development machine example:

```text
Python 3.10.12
Typst 0.14.2
PyMuPDF OK
```

Notes:

- render-only Normal path not required. OCR API or translation API。
- If Typst compilation fails and triggers LLM repair fallback, may read RETAIN_TRANSLATION_API_KEY.
- Public competitions: disable network. fallbackor provisions fallback Fail on trigger; prevents incomparable results.
- For external participants, best to provide Docker Mirror or install script, otherwise fonts and Typst Version affects results.

## Directory structure

```text
experiments/render-benchmark-533/
  case.json                  # case MetadatahashReference baseline
  README.md
  scripts/
    materialize.py           # From source job Generate locally case-data
    check_env.py             # Check deps and case Data
    run_render_benchmark.py  # Test suite run. Coverage check needed. render-only benchmark
export_typst_case.py     # Export Typst material from a certain run
    compile_typst_case.py    # Compile exports only. Typst source
  case-data/                 # Local materials, default git ignore
  runs/                      # Each complete benchmark output, default git ignore
typst-cases/               # Exported Typst sub-benchmark, default git ignore
```

## Prepare data

From source job materialize：

```bash
python3 experiments/render-benchmark-533/scripts/materialize.py
```

Overwrite Existing case：

```bash
python3 experiments/render-benchmark-533/scripts/materialize.py --overwrite
```

Output:

```text
experiments/render-benchmark-533/case-data/quantum_chem_533/job/
```

Script defaults to hard links when possible, avoids duplicate disk usage. Falls back to copy if filesystem lacks hard link support.

Script will be rewritten. source PDF in artifacts/render_prewarm/render_source_prewarm_manifest.json
Path and mtime fingerprint. Otherwise quarantine. If preheat oven is missed, warm benchmark degrades into cold benchmark.

## Run full Benchmark

Default run:

```bash
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py
```

Specify run id:

```bash
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py --run-id my-test --overwrite
```

With cProfile:

```bash
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py --run-id prof-1 --profile
```

Every time run Always creates isolated directories:

```text
experiments/render-benchmark-533/runs/<run_id>/
```

Core output:

```text
runs/<run_id>/report.json
runs/<run_id>/render.stdout.log
runs/<run_id>/render.stderr.log
runs/<run_id>/job/rendered/*.pdf
```

`report.json` Record:

- `success`
- `wall_seconds`
- `render_elapsed_seconds`
- `effective_render_mode`
- `pages_processed`
- `render_diagnostics`
- Output PDF path
- stdout/stderr paths
- Input hash
- Execute actual command

## View key latency

Use directly:

```bash
python3 - <<'PY'
import json
from pathlib import Path

report = json.loads(Path("experiments/render-benchmark-533/runs/my-test/report.json").read_text())
diag = report["render_diagnostics"]
print("success:", report["success"])
print("wall:", report["wall_seconds"])
print("render:", report["render_elapsed_seconds"])
print("prepare:", diag.get("payload_prepare_elapsed_seconds"))
print("typst source:", diag.get("typst_source_prepare_elapsed_seconds"))
print("typst compile:", diag.get("compile_elapsed_seconds"))
print("merge:", diag.get("overlay_merge_elapsed_seconds"))
print("source cleanup:", diag.get("source_overlay_elapsed_seconds"))
PY
```

## Test in isolation Typst

Full render benchmark includes source prepare, layout, Typst source generation, Typst compile,
PDF overlay merge And save. If only want to research. Typst Compile, exportable Typst case。

From a complete run Export:

```bash
python3 experiments/render-benchmark-533/scripts/export_typst_case.py --run-id my-test --overwrite
```

Export directory:

```text
experiments/render-benchmark-533/typst-cases/my-test/
```

Includes:

```text
book-overlay.typ
book-overlay.typ.prebuilt
book-overlay.pdf
typst-case.json
source-run-report.json
```

Compile only. Typst：

```bash
python3 experiments/render-benchmark-533/scripts/compile_typst_case.py \
  --typst-case my-test \
  --run-id compile-1 \
  --overwrite
```

Output:

```text
typst-cases/my-test/compile-runs/compile-1/compile-report.json
typst-cases/my-test/compile-runs/compile-1/book-overlay.pdf
typst-cases/my-test/compile-runs/compile-1/typst.stderr.log
```

This process will not rerun OCR/translate, source prepare, layout, or PDF merge; only test fixed .typ input.
Typst CLI compilation.

## warm vs cold

Current complete benchmark default warm-ish mode:

- Will copy `artifacts/render_prewarm/`
- Auto-fixes prewarm manifest's source PDF fingerprint
- source bbox-text stripped PDF and payload prewarm matchable

If testing cold Mode can be deleted. run job Inside:

```text
artifacts/render_prewarm/
```

Subsequent suggestions cold/warm Make explicit parameters, e.g.:

```bash
--mode warm
--mode cold
```

## Scoring Suggestions

Don't rank only by speed. Speed-only ranking encourages shallow processing, sacrificing quality, skipping complex pages.

Suggested rules:

1. Must succeed. PDF。
2. must pass the quality threshold.
3. After quality passes, rank by duration.

Quality threshold: add gradually.

- Text overflow
- Text overlap.
- Display formula protection
- Font size jumps
- Visual density
- PDF File size
- Sampling page screenshot diff
- Fixed page manual review

First version can start with hard thresholds:

```text
success == true
pages_processed == 533
output_pdf exists
Typst compile has no fatal error
```

Then expand visual quality scoring.

## Release data package recommendations

If providing to external algorithm developers, recommend publishing two packages:

1. Lite package: contains only typst-cases// for Typst source/compile optimization.
2. Full package: contains case-data/quantum_chem_533/job/ for completeness and render-only optimization.

Full package includes:

```text
source/
translated/
ocr/normalized/
specs/
artifacts/render_prewarm/
case.json
README.md
scripts/
```

Do not publish full. `data/jobs/<job_id>/`because it contains numerous logs, historical artifacts, and debug files, which will cause the baseline
Input not clean enough.

## Current limitations

- No automatic visual quality scoring yet.
- Currently cold/warm not explicit parameter.
- Current benchmark depends on this repo's backend code, not a standalone Python package.
- Current fontTypst Version and system environment affect absolute runtime.
- Real PDF public distribution requires separate authorization confirmation.
