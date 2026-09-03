# `src/js/reader` — Legacy reading engine + Limited sharing ports

Imperative pdf.js Pipeline (`pdf-controller` / `pdf-renderer` / mode / favorites / regions…）。

Default product path is already **react-pdf**（`pages/reader/ReaderAppReactPdf`). This directory primarily serves **`?engine=legacy`**。

## Layering (with `pages/reader/README` Align)

| Purpose | Module | Imported by |
|------|------|-----------|
| **Shared ports** | `data-port`, `config-port`, `resource-resolver`, `pdf-document` (URL (`page-state` progress copy) | New engine `pages/reader/external.ts`; legacy use directly. |
| **Legacy engine** | `pdf-controller`, `pdf-renderer`, `viewer-mount-flow`, `selection-favorites`, `favorites/**`, `region-*`, chrome/modeâ¦ | Only `pages/reader/legacy/**` |
| **legacy AI** | `ai/ask-answerer`、`ai/chat-history-store`、`markdown-render`… | `legacy/ai`、`use-reader-boot` |

## Deleted

| File | Description |
|------|------|
| `ai/remote-answerer.ts` | Old `/reader/ai/chat` payload transponder; live network `ask-answerer` |

## Do Not

- Don't add new code here. UI(Annotation) / Zoom / Side-by-side â `pages/reader` (non-legacy)
- No batch delete. favorites / pdf-*（legacy Still relies on internal graph.  
- Don't assume `pages/reader/components/*` Flat existence (migrated `legacy/components/`）

## Main path

```text
Default: pages/reader/ReaderAppReactPdf + hooks/ + pdf/ + annotations/ + components/react-pdf/
JS dependencies â pages/reader/external.ts â This directory is shared ports
Fallback: pages/reader/legacy/*  +  Imperative engine for this directory.
Map: src/FEATURES.md
```
