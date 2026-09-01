# Frontend and Desktop Contribution Guidelines

## Directory boundary

- `frontend/`The static frontend source code currently used in production is also the desktop client. bundle input.
- `frontend-react/`New React Frontend migration zone. Not directly replaced. `frontend/`。
- `desktop/`：Electron Desktop packaging.
- `desktop/app/frontend/**`Frontend bundle actually read by the desktop client bundle，not primary edit entry.

## Start locally

```bash
cd frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

React To start migration area separately:

```bash
cd frontend-react
npm run dev
```

Default port: 40002; entry still migration zone, not direct production replacement for frontend/.

Default ports:

- Web frontend: 40001
- Rust API：`41000`
- multipart async submit API: 42000

Frontend API base rules see Local startup and configuration.

## Desktop sync

Modify `frontend/src/**`、`frontend/*.html`、`frontend/src/styles/**` or other desktop entry points bundle Sync desktop after frontend assets.

```bash
npm --prefix desktop run verify-frontend-sync
```

This command rebuilds static frontend and syncs to desktop. bundleand run the desktop frontend. smoke。

## Change rules

## Change rules
- UI Prioritize existing for logic. feature/controller/view Modularize. Do not cram new flows into a single entry file.
- Add download.readerVerify desktop support for status cards and glossary features. bundle Also passes. `npm --prefix desktop run verify-frontend-sync`。
- Frontend needs new addition. API When field, first confirm whether the backend is stable. view/projection, do not let the frontend guess from internal payload、raw artifact Or guess from database fields.
- `frontend-react/` Changes should clearly indicate migration zone capabilities, unless PR Goal: switch production entry.

## Common checks

```bash
npm --prefix frontend run build
npm --prefix desktop run verify-frontend-sync
```

Frontend end-to-end state smoke will actually submit tasks; usually requires local Rust API, OCR token, model keys, and sample PDFs; run only when these conditions are met.

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```
