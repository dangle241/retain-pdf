# RetainPDF Frontend (main site)

**Production entry: this directory `frontend/`**Static 3 pages. SPA：`index` / `detail` / `reader`）。

| Directory | Description |
|------|------|
| `src/pages/home` | Home Bookshelf Upload Tasks |
| `src/pages/reader` | Reader (Default react-pdf; see that directory README） |
| `src/pages/detail` | Task Details |
| src/js | Shared API / Imperative domain / Legacy reading engine / mock |
| `src/styles` | Global and Per-Page CSS |

Folder logic and dual features tree see src/FEATURES.md
（`js/features` = Domain;`pages/home/features` = React UISee also Reader. `pages/reader` + `js/reader`.)

## With frontend-react/

Repo root also has frontend-react/: independent Vite experiment/migration area on port 40002, do not replace this directory. Daily dev and release are based on frontend/.

## Common commands

```bash
npm run build        # css + js + stamp
npm run build:js
npm run build:css
npm test
python3 scripts/serve_static.py --host 127.0.0.1 --port 40001 --root .
```

| Document | Content |
|------|------|
| `src/FEATURES.md` | Site Directory / dual features / Three Layers of Reader / detail external |
| `src/pages/reader/README.md` | Reader react-pdf vs shared ports vs legacy |
| src/js/reader/README.md | Old pdf.js engine boundaries |
| src/pages/detail/README.md | Details external rules |
| `src/pages/home/composition/README.md` | Homepage assembly rules |
| src/pages/home/features/README.md | Home React domain index |
| `src/styles/README.md` | CSS Unpack by page (home/detail/reader） |
