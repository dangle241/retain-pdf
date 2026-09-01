# Frontend documentation

Frontend integration, state checks, and optimization records — not business product documentation.

- [Frontend Status Smoke](./status_smoke.md)
- [Frontend Optimization Notes](./optimization_notes.md)
- Frontend status smoke latest report

Main entry point:

- `frontend/src/js/`
- `frontend/src/styles/`
- `frontend/package.json`

Desktop sync:

- After modifying frontend/src/**, run npm --prefix desktop run sync-frontend to rebuild frontend sync to desktop/app/frontend.
- Before commit, run npm --prefix desktop run verify-frontend-sync; desktop sync runs smoke before desktop frontend starts, avoiding Electron packaging continuing with old page.
