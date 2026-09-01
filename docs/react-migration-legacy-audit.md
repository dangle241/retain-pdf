# React Migration: Legacy tree reachability audit (Phase 0 Output)

Audit Target: `src/js/job/` (14 files), `src/js/job-status/` (54), `src/js/status-detail/` (5).
Method: esbuild metafile From three real entry points. (app-bundle-entry.js / reader/index.js / job-detail/index.js) Compute reachable set + Reverse import graph + DOM API scan.

## Conclusion

| tree | Live VM | Live view | Test references only | Dead code | Total.Total |
|---|---|---|---|---|---|
| job/ | 14 | 0 | 0 | 0 | 14 |
| job-status/ | 45 | 0 | 3 | 6 | 54 |
| status-detail/ | 5 | 0 | 0 | 0 | 5 |
| **Total** | **64** | **0** | **3** | **6** | **73** |

**Three Trees: pure logic core, inherit verbatim during migration., Not dead code.** All reachable files are plain text. view-model/adapter, zero DOM rendering (DOM Views are in components/, ui/, job-detail/view.js etc.).

## Phase 4 Deletion list (9 files, Self-contained isolated subgraph., Delete all.)

**Safe to delete.(6,Zero references, or referenced only by dead files.):**
- src/js/job-status/stage-presentation-event.js(cluster root)
- src/js/job-status/stage-presentation-fallback.js(Completely isolated)
- src/js/job-status/stage-presentation-event-context.js
- src/js/job-status/job-stage-progress-strategy.js
- src/js/job-status/stage-progress-selection.js
- src/js/job-status/stage-progress-view-data.js

**Only referenced by tests/job-stage-contract.test.mjs (lines 10-12 import) (3):**
- src/js/job-status/canonical-stage-snapshot.js
- src/js/job-status/job-stage-event-selection.js
- src/js/job-status/main-lane-stage-selection.js

Delete these 3 Sync tests required.;Keep this if tests retained. 3 File.

## Note
- `job/action-model.js`, `job/artifacts.js` Guarded `window.location.href` read (URL construction, not DOM rendering), Liveness VM; Heavily referenced by live code., Not in deletion scope.
- No external activity. import() See above 9 files (Verified).
