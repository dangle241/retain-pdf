# Task details page (`pages/detail`）

Standalone SPA：`detail.html` → `entry.tsx` → `DetailApp`。

## Layout

```text
pages/detail/
  entry.tsx / DetailApp.tsx
external.ts              # the only exit for src/js/*
  components/              # UI（Header / Artifacts / Events…）
```

## Rules

| Layer | Rule |
|----|------|
| `DetailApp` / `components/**` | **Prohibited** direct `import â¦ from "../../js/â¦"` |
| `external.ts` | Only allowed import `src/js/*` file; missing symbol, fix here only |
| `js/job-detail/*` | Imperative overview / markdown / resume logic (via external Integrate |

Access Control:`tests/architecture-boundaries.test.mjs`  
（`detail page must not import src/js/* directly`）

## Status Strategy (Summary)

- copy / link:React state（`texts` / `links`Syntax error. Fix: Remove extra parenthesis. job-detail Write Callback  
- Artifact list, failure debugging,Markdown Image Grid: Imperative innerHTML Silo (see component annotations)  
- Modal / download toast: React (Radix Dialog + DownloadToastHost)
