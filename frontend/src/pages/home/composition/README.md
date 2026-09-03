# home/composition

Homepage assembly layer.**Wire only. No business logic.**

Dual features Compare (`js/features` vs `pages/home/features`see **`src/FEATURES.md`**。

## Rules (Must-read for future maintenance)

1. **`external.ts` Homepage pair. `src/js/*` sole entry point (features Layer)**  
- `pages/home/features/**` **Prohibited** direct import of any `src/js/**`, always `from "../composition/external.js"` Deep self-tuning.
   - Domain factory (`create-*.ts`should also go through `./external.js`, do not open again `../../../js/…`。  
- `composition/types.ts` port/store Types also obtained from `./external.js`.
   - if symbols are missing, only modify `external.ts`See access control `tests/architecture-boundaries.test.mjs`。  
   Source code fully delivered. TS；import Path still writable `.js`（esbuild / test loader Map to `.ts/.tsx`）。

2. **Factory returns bagavoid mutable `ctx`**  
   `createXxx(...)` returns its own artifacts;`composition.js` Explicitly assign to `features` / `domains`。

3. **`features` Sole mutable registry.**  
   Late binding (A During assembly. B Not created) Pass `features.xxx` Read. Call after assembly complete.

4. **runtime Mount all at once**  
Exclude `job-runtime` / `recent-jobs` / `artifact-downloads` during composition Create stage. Lazy mount via `initialize`'s `if (!feature)`.

5. **Event registration order is contractual.**  
   `workflowDialog.bindEvents()` Must precede. `mountRecentJobsFeature`  
  （`closeTranslationWorkflow` Write first when needed. DOM `data-open`，recent-jobs Skill `scheduleRefresh`）。

## Files

| File | Responsibility |
|------|------|
| `../composition.js` | Sequential Wiring Entry |
| `external.js` | External dependencies barrel |
| `create-bridge.js` | 3b Callback Bridge |
| `create-workflow-upload.js` | workflow + upload |
| `create-credentials.js` | Credentials |
| `create-glossaries-app-update.js` | Glossaries + Updates |
| `create-status-domain.js` | statusCard / detail / reader |
| `create-library-domain.js` | library / recent-jobs ports / collections |
| `create-app-actions.js` | Submit Tasks |
| `create-runtime-features.js` | job-runtime / recent-jobs / artifacts |
| `create-lifecycle.js` | initialize / dispose |
| `build-home-services.js` | External HomeServices bag |
