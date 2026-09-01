# pretext First-level evaluation

Evaluation target:

- <https://github.com/chenglou/pretext>
- <https://github.com/chenglou/pretext/blob/main/STATUS.md>

Evaluation conclusion:

`pretext` Worth entering `layout-fit` candidate solution list, but in the first stage, do not directly designate it as the sole measurement core. A more prudent positioning is: alongside the native HTML/DOM parallel measurement engines, as a more controllable, cacheable, low reflow Measure block-level text layout. Compare samples.

## Alignment with layout-fit

`layout-fit` The most critical issue is block-level fitting: given text, font, target width and height, and candidate layout parameters, stably compute line count, height, and width overflow, then select the set of parameters closest to the target box.

`pretext` core direction aligns closely with this problem:

- It breaks text layout into programmable preparation and layout steps, rather than relying entirely. DOM reflow。
- It is exposed. `prepare()` and `layout()` Base entry: repeated scans of same text across parameter sets.
- Supports `layoutWithLines()`、`prepareWithSegments()`、`measureLineStats()` Await finer-grained interface; retrieves per-line results and line statistics.
- It emphasizes a low-allocation, low-latency text layout path, suitable for subsequent batch sample scanning or real-time parameter tuning.

## Directly servable capabilities

First-layer reusable capabilities: primarily measurement and layout, not complete. PDF Recovery:

- Given a width constraint, calculate how text wraps.
- Get layout metrics: line count, line width, overall height.
- Supports repeated layout runs with different parameters for font size, line height, and paragraph width scanning.
- Support finer text segment input, providing space for subsequent processing of Chinese-English mixed layout, emphasis styles, or placeholder preservation.

## Issues not directly resolvable

These capabilities still require `layout-fit` Roll your own upper-layer wrapper.

- Extract block-level samples from `document.v1.json` and `translated/page-XXX-deepseek.json`.
- Define `fixtures` Sample format and experimental output format.
- Map measurement results to Typst Font size, line height, paragraph parameters.
- Implement page-level multi-block playback, collision detection, and mixed text-image layout restoration.
- Verify CJKmixed CJK and English, inline formulas, and OCR Actual error in box coordinates.
- Compare DOM, `pretext`, Typst Three: row count & height differences on same samples.

## Current risk

The main risk does not lie in `pretext` Not whether valuable, but whether close enough to final layout target:

- Its layout model is not equivalent to. Typst, cannot directly treat the output as Typst Truth value.
- Font measurement consistency may still be affected by browser,Canvas Font loading and platform font differences impact.
- If we need strong control. `letter-spacing`paragraph spacing, Chinese punctuation compression, or formula placeholder width, additional adapters may be required adapter。
- If samples mainly come from OCR Provide source text. PDF Block size. Normal text layout metrics insufficient; add separate ones. OCR/Typst Compare Scores.

## Recommended location

Next step not single track. HTML/DOM Measuring device, but rather change to dual-track:

- Track A：HTML/DOM Baseline Measurer.
- Skip mount B：`pretext` Candidate Meter.

Two tracks use same batch. `fixtures`Output the same set of metrics.

- `lineCount`
- `height`
- `maxLineWidth`
- `overflowX`
- `overflowY`
- `score`

First round PoC only needs to answer one question: on 5 to 10 real text block samples, are `pretext` line count, height, and overflow judgments more stable and easier to parameter-scan than the DOM baseline?

If PoC results are stable, consider `pretext` as a formal measurement adapter in `scripts/` or `html/`; otherwise, keep DOM/Typst only as reference if discrepancy is too large.

## Current implementation status

`layout-fit` already added to browser side. PoC entry:

- `html/pretext.html`
- `package.json`

Dependencies can be installed normally via domestic mirror:

- `npm install --registry=https://registry.npmmirror.com`

Additionally, one important fact has been confirmed:

- `@chenglou/pretext` Current Node Environment supports imports. Use existing modules.
- but actual execution of `prepare()` / `prepareWithSegments()` requires `OffscreenCanvas` or DOM canvas context.
- Therefore the most reasonable currently. PoC Location is browser-side, not pure. Node CLI Script.
