# `pages/home/features` â Home React Feature domain

Place Home **UI / view-store / dialogs** here.
Imperative domain (`mount*`pollingports) in **`src/js/features`**experienced `../composition/external.ts` Integrate.

See full double-tree comparison at **`src/FEATURES.md`**。

## Table of Contents

| Domain | Description |
|----|------|
| `library/` | Bookshelf, Book Details, Card actions (see [library/README.md](./library/README.md)) |
| `collections/` | Collections / Categories related |
| `upload/` | Upload area React store / View |
| `workflow/` | Translation Workflow Dialog runtime + UI |
| `status/` | Main Status Area, Status Card store |
| `status-detail/` | status details dialog store / controller |
| `credentials/` | Credential Settings UI |
| `glossaries/` | Glossary UI |
| `app-update/` | App Update Bar |
| `app-shell/` | Bottom bar and other shells |
| `reader/` | Home sidebar「Open to read」Dialog store(not `pages/reader` Reader） |
| `settings/` | Settings entry orchestration |

## Rules

1. **New UI** Prefer local directory scope. Do not inject into `js/features`.
2. **Need to call `src/js/*` (contains api / config / job-status / featuresâ¦)**: **Forbidden** to directly `import â¦ from "../../../../js/â¦"`. Always use `../composition/external.js`. Adjust depth. Use CSS. â skipped: JS, add when dynamic adjustments needed. `../`) to use; when symbols are missing, only modify **Change only** `composition/external.ts` Access Control: `tests/architecture-boundaries.test.mjs`.
3. **library Progress contract**: `selectJob` opens workflow popup; `attachJobProgress` only shows progress without popup (see library README).
4. Unrelated to **`pages/reader`**: reader page code is in `pages/reader/**`.
