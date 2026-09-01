# Frontend optimization notes

These instructions only focus on the current. `frontend/` Real technical debt, for frontend peers to quickly judge:

- Which issues must be fixed first?
- Which issues directly slow later development?
- Which issues are merely experience-layer optimizations?

## Current structure overview

Frontend is now a very lightweight native. JS + Tailwind Page, no framework, and no bundler/runtime state Management.

Quantification:

- Core interaction entry:[main.js](../../frontend/src/js/main.js) approximately `1291` rows
- UI rendering layer: ui.js about 624 lines
- Task data shaping layer: job.js about 424 lines
- Main style file: components.css about 1747 lines
- Total frontend source code approx. `224K`
- `frontend/node_modules` Stored, approx. `16M`

Conclusion: Not "too many features" — "no stable layering." Complexity concentrates in a few large files.

## P0Priority issues to address

### 1. Main entry bloated. Business logic, event binding, polling, form assembly coupled.

Files:

- [main.js](../../frontend/src/js/main.js)

Problem:

- `main.js` Also responsible for:
- Token validation
  - Form Collection
- Submit task
- Poll task
  - Recent Tasks
  - Developer Settings
  - Browser credentials prompt
  - Page Event Master Binding
- This makes any small change likely to affect other processes.

Suggestions:

- Split into at least 4 Module
  - `job-submit.js`
  - `job-polling.js`
  - `recent-jobs.js`
  - `settings-dialog.js`
- `main.js` Keep only:
  - Page Initialization
  - Module Assembly
  - Top-level error fallback

### 2. Global mutable state too primitive; lacks update boundaries.

Files:

- [state.js](../../frontend/src/js/state.js)
- [main.js](../../frontend/src/js/main.js)
- [ui.js](../../frontend/src/js/ui.js)

Problems:

- `state` Plain object; write directly across multiple files:
  - `state.currentJobId = ...`
  - `state.recentJobsItems = ...`
  - `state.timer = ...`
- No mutation boundary or subscription mechanism.
- Currently still manageable because the page is simple; once the frontend adds more features, tracing state origins will become increasingly difficult.

Suggestions:

- Not required. Remove. React/Vue。
- First make a lightweight version. store：
  - `getState()`
  - `patchState(partial)`
  - `subscribe(key, fn)` or simple `subscribe(fn)`
- At least extract these parts:
  - `jobState`
  - `uploadState`
  - `recentJobsState`
  - `developerState`

### 3. Large volume `innerHTML` Concatenation, rendering, and event binding are fragile.

Files:

- [ui.js](../../frontend/src/js/ui.js)
- [templates.js](../../frontend/src/js/templates.js)
- [main.js](../../frontend/src/js/main.js)

Problems:

- Multiple sections directly rewritten in full:
  - `document.body.innerHTML = ...`
  - `list.innerHTML = ...`
- Recent task list will also be used:
  - `list.innerHTML = reset ? markup : \`\${list.innerHTML}\${markup}\``
- Problems with this approach:
  - Event bindings can be lost.
  - Partial refresh uncontrollable.
  - Performance and state consistency both mediocre.

Suggestions:

- No need refactor into component framework.
- First change the high-frequency list to DOM Node rendering:
  - `document.createElement`
  - `replaceChildren`
  - `append`
- Priority:
  - Event Stream List
  - stage history
- Recent task list

### 4. Hardcoded dev password in frontend. Critical security risk. Remove immediately. Use env vars or secure backend auth.

Files:

- [main.js](../../frontend/src/js/main.js)

Problems:

- Exists:
  - `const DEVELOPER_PASSWORD = "Gk265157!";`
- This is equivalent to exposing passwords on the frontend, with no real security.

Suggestions:

- If only "hide advanced configuration", change directly to:
  - Local switch
  - `runtime-config`
  - Desktop settings page entry
- If authentication is truly required, it must be moved to the backend or desktop host layer.

## P1Issues significantly impacting maintenance efficiency

### 5. Job Data shaping layer too thick; frontend bears excessive backend compatibility logic.

Files:

- [job.js](../../frontend/src/js/job.js)

Problems:

- `normalizeJobPayload()` Doing extensive "fallback compatibility":
  - Multiple fields fallback
  - Absolutely. URL completion
  - actions / artifacts Dual-source compatibility
  - runtime / failure / legacy Merge Style Fields
- This shows that although the backend response contract has stabilized, the frontend is still written with "loose compatibility".

Suggestions:

- Frontend can ask backend for a more stable one. view contract。
- `normalizeJobPayload()` Goal should converge into two work categories:
  - envelope unwrap
  - Lightweight Formatting
- Don't make it carry interface compatibility layer.

### 6. Polling logic too tightly coupled with detail requests.

Files:

- [main.js](../../frontend/src/js/main.js)

Problems:

- `fetchJob(jobId)` One request serial pull.
  - job detail
  - job events
  - artifacts manifest
- Fixed polling frequency `3000ms`
- No state-based adaptation.

Suggestions:

- Split into:
  - `pollJobSnapshot`
  - `refreshEvents`
  - `refreshArtifactsManifest`
- Strategy:
  - `queued/running` Timed high-frequency polling detail
  - events / manifest Low Frequency Refresh
  - `succeeded/failed/canceled` Stop Now

### 7. Config sources scattered. Browser/desktop logic mixed. Separate.

Files:

- [config.js](../../frontend/src/js/config.js)
- [desktop.js](../../frontend/src/js/desktop.js)
- [main.js](../../frontend/src/js/main.js)

Problems:

- Three source sets intermingled.
  - runtime config
  - localStorage browser config
  - desktop bridge config
- Judging everywhere in the page logic `desktopMode`

Current progress:

- Added desktop-host.js to unify recognition via retainPdfDesktop and keep only __TAURI_INTERNALS__ compatibility shim.
- [config.js](../../frontend/src/js/config.js) No longer probe old bridge name. Desktop unified call from host Enter abstraction.

Follow-up suggestions:

- Can continue. `desktop.js` In “First Startup”/For desktop-specific flows like "Save Configuration", abstract one more layer up to the host layer.
- UI Layer read-only capability; does not directly read host differences.

### 8. Styles concentrated in single file. Component boundaries unclear.

Files:

- [components.css](../../frontend/src/styles/components.css)

Problems:

- Single file about 1747 lines
- dialog、topbar、hero、developer panel, status area, event list all mixed together

Suggestions:

- At least split by region:
  - `layout.css`
  - `dialogs.css`
  - `job-status.css`
  - `developer-panel.css`
  - `recent-jobs.css`

## P2Experience and Engineering Standards Suggestions

### 9. `node_modules` Do not commit to repository

Files:

- `frontend/node_modules`

Problems:

- Current repo has full dependency directory, approximately `16M`

Suggestions:

- Frontend: clear and confirm. `.gitignore` take effect.
- Keep only:
  - `package.json`
  - `package-lock.json`

### 10. No frontend tests or baseline. lint

Files:

- [package.json](../../frontend/package.json)

Problems:

- Only:
  - `build:css`
  - `watch:css`
- None:
  - `lint`
  - `test`
  - `format`

Suggestions:

- Minimal completion:
  - ESLint
  - Prettier
- 1-2 tests for job.js normalize/summarize series

## Suggested optimization order

### Phase 1: Low-risk closure

- Remove hardcoded developer passwords from frontend.
- Remove `node_modules`
- Replace recent tasks / event stream / stage history innerHTML concatenation with DOM rendering.
- Split main.js at least into three modules: submission, polling, and recent tasks.

### Phase 2: Structural Governance

- Add Lightweight store, converge `state`
- Separate configuration sources; isolate. browser/desktop Host differences
- Shrink [job.js](../../frontend/src/js/job.js) Compatibility layer responsibilities

### Phase 3: Engineering Completion

- Split style files.
- Add lint/format/minimal tests
- Then decide whether to adopt a framework

## Frontend conclusion

The frontend isn't "poor performance" — it's "loose structure".

The first priority is not replacing the framework, but:

1. Remove main.js
2. Consolidate bare state
3. Move high-frequency areas from innerHTML to stable DOM rendering
4. Remove mock auth and host-specific workarounds from frontend.

Once this is done, whether you continue writing native JS, or migrate React/Vuecosts will be much lower.
