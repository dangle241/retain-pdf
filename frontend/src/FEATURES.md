# Frontend feature tree map (`frontend/src`）

Daily dev **`frontend/`** prevail (not `frontend-react/`）。  
This document explains the two sets of 「features」, the reader dual-engine, and where to put shared js/*.

## Overview

```text
frontend/src/
├── pages/
│   ├── home/          # Home SPA (React shell + assembly)
│   │   ├── composition/   # Wire only:external → js/features + home features
│   │   └── features/      # React UI / store / Homepage-exclusive orchestration
│   ├── reader/        # Reader SPA(default react-pdf；legacy Revert
│   └── detail/        # Task detail SPA
├── js/
│   ├── api/           # HTTP / Backend contract
│   ├── features/      # Imperative domain logic (mount*、ports、state）
│   ├── reader/        # Old pdf.js engine + minor reused by new engine ports
│   ├── job-status/ job/ job-detail/ status-detail/  # Task Display Logic
│   ├── state/ config/ mock/ islands/ …
└── styles/ components/ shared/ partials/
```

| Layer | Path | Responsibility | Where to put new code |
|----|------|------|------------|
| Page React | pages/*/features or pages/reader/* | UI, hooks, page store | new UI / new interaction |
| Imperative domain | js/features/* | Mount, poll, form ports | reusable UI logic not needed across pages; simplify |
| **Share API** | `js/api/*` | fetch Encapsulation | New backend endpoint client |
| **Assembly** | `pages/home/composition/*` | Wiring only. No business logic. | Composition entry points for the home page. |

---

## Homepage: dual features tree

Homepage contains both

1. src/js/features/* — extracted from old main path, imperative domain (mountXxxFeature, ports, DOM contract, state)
2. src/pages/home/features/* — React side views, store, dialog, bookshelf UI

They are not a duplicate directory, but UI layer vs domain layer; see wiring rules in pages/home/composition/README.md:

- Domain factories should be referenced from composition/external.ts to js/*, avoiding scattered ../../../js imports from features.
- Exception: a few types / Pure functions already directly from `pages/home/features` import `js/features`（Historical debt, prioritize new additions. external）

### Lookup table (similar names) ≠ Same module)

| `js/features/` | `pages/home/features/` | Relations |
|----------------|------------------------|------|
| `upload/` | `upload/` | domain mount + form ↔ React upload view store |
| `workflow/` + `translation-workflow-dialog/` | `workflow/` | Imperative workflow + Dialog Contract ↔ React Workflow Dialog |
| credentials/ | credentials/ | credentials mount/DOM ↔ React settings UI |
| glossaries/ | glossaries/ | glossary controller ↔ React glossary |
| `app-update/` | `app-update/` | GitHub release / cache ↔ React Update Entry |
| `app-shell/` | `app-shell/` | idle reset / config ↔ Bottom bar shell UI |
| `app-actions/` | No duplicate names. Ensure uniqueness. | Submit task; by composition Attach status/upload |
| job-runtime/ | (no counterpart) | current task polling status / library consumer |
| recent-jobs/ + documents-library/ | library/ + collections/ | recent tasks + document resources ↔ bookshelf card / collection |
| status-detail/ | status/ + status-detail/ | detail logic ↔ status card / detail popup React |
| reader-dialog/ | reader/ | reading entry routing/contract ↔ home 「Read」 dialog store |
| `home/` | Scattered | home state port |
| `artifact-downloads/` | Syntax error. Missing closing parenthesis. Fix: Add `)`. library/status） | Download Artifacts |
| (none) | settings/ | homepage settings entry (near credentials/update) |

### Homepage code modification mnemonic

| To modify… | Priority path |
|---------|----------|
| Bookshelf card / Details popup UI | `pages/home/features/library/**` |
| Upload form UI | `pages/home/features/upload/**` |
| Task pollingactive job | `js/features/job-runtime/**` |
| Submit translation task | `js/features/app-actions/**` + composition |
| Incomplete input. js import dependencies on homepage. | only modify composition/external.ts + corresponding create-*.ts |

`library` See subdirectory conventions. `pages/home/features/library/README.md`。

---

## Reader: three-layer boundary (with homepage features Irrelevant)

| Layer | Entry / Path | js dependencies |
|----|-------------|-------------|
| **A New engine (default)** | `ReaderAppReactPdf` + `hooks/` `pdf/` `annotations/` `components/react-pdf/` | Only via **`pages/reader/external.ts`** |
| B shared ports | js/reader subset: data/config/resource/pdf-document/page-state… | via external exit; do not block pdf-controller |
| **C legacy** | `?engine=legacy` → `legacy/**` + **`js/reader` Imperative core** | Allow direct import `js/reader/**` |

Details: pages/reader/README.md, js/reader/README.md.

Do not write new features into legacy/ or js/reader/favorites*.

## Details Page

| Path | Rule |
|------|------|
| pages/detail/** | js only via pages/detail/external.ts |
| `js/job-detail/*` | overview / markdown / resume Imperative logic |

---

## `js/` Other directories (quick reference)

| Directory | Purpose |
|------|------|
| api/ | backend API client |
| job-status/, job/, job-detail/ | task phase / artifacts / detail page logic (shared between detail and home status) |
| `status-detail/` | status details presenter(older path; with `js/features/status-detail` Actual prevails when coexisting. import shall prevail) |
| state/, config/ | global store slice, runtime config |
| `islands/` | Mountable to old HTML of the small island (such as library-search、reader-annotations） |
| `mock/` | Testing & Local mock |
| app-framework/ | lightweight connector/store primitive |
| `styles/` | **Split packages by page** `dist/css/{home,detail,reader}.css`; see **`styles/README.md`** |

---

## Dead code strategy

- Document first, then delete: if rg finds no importer, it's likely dynamic path or test-only.
- `js/reader` Almost all are legacy Link references (including internal). Removed those without production references. `ai/remote-answerer.ts`。
- **`pages/home/features` → `src/js/*`**experienced `pages/home/composition/external.ts`。
- pages/detail → src/js/*: via pages/detail/external.ts.
- pages/reader non-legacy → src/js/*: via pages/reader/external.ts; legacy/** excluded.
- Do not batch delete js/reader/favorites/* or pdf-renderer etc. — they serve selection-favorites / pdf-controller for ?engine=legacy.

---

## Related README

| File | Content |
|------|------|
| frontend/README.md | Entry, commands, and frontend-react relationship |
| pages/home/composition/README.md | home page assembly rules |
| pages/home/features/README.md | home React features index |
| `pages/home/features/library/README.md` | Bookshelf directory |
| `pages/reader/README.md` | New Reader/Old layout |
| `js/reader/README.md` | Legacy Engine Boundaries and Sharing ports |
