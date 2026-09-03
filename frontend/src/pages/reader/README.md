# Reader directory (`pages/reader`）

Default engine:**react-pdf**（`ReaderAppReactPdf`）。  
Rollback:`?engine=legacy`（`ReaderApp` Internal branch + `legacy/**` + `src/js/reader` Imperative engine).

## Three-layer boundary

```text
┌─────────────────────────────────────────────────────────────┐
│  A. New Engine UI/Logic (Default)                                    │
│     hooks/  pdf/  annotations/  components/react-pdf/         │
│     ReaderAppReactPdf.tsx                                     │
â     js dependencies â only via ./external.ts                              â
└──────────────────────────┬──────────────────────────────────┘
                           │ Share Only ports
                           ▼
┌─────────────────────────────────────────────────────────────┐
â  B. Shared ports (js/reader subset + small config/api)            â
│     data-port / config-port / resource-resolver /             │
│     pdf-document(resolve URL) / page-state(Copy Constants)          │
│     via pages/reader/external.ts Export                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ legacy Use more frequently
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  C. Old imperative engine (?engine=legacy）                            │
â     pages/reader/legacy/**  +  all js/reader                   â
│     pdf-controller / pdf-renderer / favorites / regions…      │
│     Allow directly import js/reader(do not put into external Impersonate Share)    │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Path | Where to put new features? |
|----|------|------------|
| **A New engine** | `hooks/`、`pdf/`、`annotations/`、`components/react-pdf/` | Annotation, zoom, comparison, scroll anchor |
| **B Shared** | `external.ts` -> `js/reader/{data,config,resource,...}` | Session-only/Resources/URL, does not write UI |
| **C legacy** | `legacy/**` + `js/reader/**` Main force | **Do not** define features. Scope? Value? |

## Layout

```text
pages/reader/
  entry.tsx / ReaderApp.tsx / ReaderAppReactPdf.tsx
  external.ts                # New engine pair js/* Single exit point
  hooks/                     # Session, zoom, anchor, annotation, controller
  pdf/                       # Document/PageScrolling, line height
  annotations/               # New annotation + localStorage
components/react-pdf/      # New engine UI
legacy/                    # Legacy shell UI + boot + drawer AI
    components/
    hooks/use-reader-boot.ts
    state/
    ai/
```

## Entry

| File | Purpose |
|------|------|
| `entry.tsx` | Mount `ReaderApp` |
| `ReaderApp.tsx` | `engine=legacy` → Old shell, otherwise `ReaderAppReactPdf` |
| `hooks/use-reader-react-controller.ts` | New Engine Logic Integration |
| `external.ts` | New Engine shared js dependencies |

## Do Not

- New feature received `js/reader/selection-favorites` / `favorites/*`  
- Import `pdf-controller` into `external.ts` for new engine.
- Assume component remains flat. `components/*` (old UI is already in `legacy/components/`)

Sitemap:`src/FEATURES.md` · Legacy engine details:`src/js/reader/README.md`
