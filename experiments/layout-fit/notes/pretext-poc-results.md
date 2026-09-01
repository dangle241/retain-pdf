# Pretext PoC Results

Date:

- 2026-04-07

Environment:

- Local static server:`python3 -m http.server 4173`
- Browser:`chromium --headless --disable-gpu --no-sandbox`
- Install dependencies:`npm install --registry=https://registry.npmmirror.com`

## Verified page

- `html/index.html`
- `html/pretext.html`

Both pages support it. URL Auto-run parameters:

- `?autoload=1`
- `&sample=<sample_id>`
- `&autorun=1`

Example:

- `http://127.0.0.1:4173/html/index.html?autoload=1&sample=20260407033349-ffe2e4:p002-b0002&autorun=1`
- `http://127.0.0.1:4173/html/pretext.html?autoload=1&sample=20260407033349-ffe2e4:p002-b0002&autorun=1`

## First browser-side comparison result.

Sample:

- `20260407033349-ffe2e4:p002-b0002`

Parameters:

- Width: `447.45pt`
- Font size:`11.06pt`
- Line height: approx. `6.64pt`
Retains current page's "multiply by font size". Typst `max_leading_em` approximation method used only for first round PoC input check.

Results:

- DOM height: `53.16pt`
- Pretext height: `53.12pt`
- height diff: `0.04pt`
- DOM lineCount: `8`
- Pretext lineCount: `8`
- DOM maxLineWidth: `597pt`
- Pretext maxLineWidth: `442.03pt`

## Current Conclusion

First, confirm three things:

1. `@chenglou/pretext` Now installable locally in this experiment directory and importable by browser pages.
2. Use same batch `fixtures` for DOM and `pretext` to auto-sync block height and line count. Remove manual checks.
3. At least on sample `p002-b0002`, `pretext` height and line count are very close to DOM.

This also reveals a critical issue:

- Current DOM Page pair `maxLineWidth` reads `scrollWidth`, which reflects the scroll width of the entire block box, not necessarily the actual width of the widest line of text.
- `pretext` `maxLineWidth` calculates text width line by line, so the two are not yet strictly comparable in measurement basis.

This means the next step should prioritize unifying the definition of the "widest line" metric, then continue expanding with more samples.

## Next steps

- Change DOM Baseline page width metric from `scrollWidth` to a per-line basis, and align `pretext`.
- Use current. 5 Run all samples DOM / `pretext` Compare. Record height diff, line count diff, widest line diff.
- Reimport Typst for comparison and confirm whether DOM or `pretext` is closer to Typst results.
