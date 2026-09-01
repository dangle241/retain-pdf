# Frontend CSS Architecture (split by page)

Three pages **Stop sharing single copy.** Site-wide `styles.css` Build outputs three independent packages:

| HTML | Entry source code | Output |
|------|----------|------|
| `index.html` | `entries/home.css` | `dist/css/home.css` |
| `detail.html` | `entries/detail.css` | `dist/css/detail.css` |
| `reader.html` | `entries/reader.css` | `dist/css/reader.css` |
| `?engine=legacy` | `entries/reader-legacy.css` | `dist/css/reader-legacy.css`Dynamic Injection |

Compatibility: `styles.css` = `home.css` Copy (legacy docs/script); **HTML Pointer updated to `dist/css/*`**.

## Table of Contents

```text
src/styles/
  entries/           # Page entries (who import What = coupling boundary)
    home.css
    detail.css
reader.css          # Default react-pdf
    reader-legacy.css   # ?engine=legacy Add-on
  core/              # Minimum cross-page shared styles
    tailwind-theme.css
    download-toast.css
  tokens.css / base.css / shadcn-theme.css / dialog-shell.css
components*.css    # Shared UI (button-link/label/mono... Reader avoids importing entire package. Use specific functions.
  pages/home/*       # Home Domain(components.utilities Remove + library/status/upload…）
  pages.css + pages/detail/*
  reader/ + reader.utilities.css
```

## Coupling rules

1. **Page-specific styles only go into the corresponding file. entry**  
   - Homepage: Bookshelf, Upload workflow, Status card, Credentials, Collections…  
   - Details:`pages.css` + `pages/detail/*`  
   - Reader default:`reader/layout|chrome|content|react-pdf|fab*|float-ai*|hud…`  
- Reader legacy: `layout-legacy|chrome-legacy|side-drawer|favorites|selection|ai|annotations...`
2. **Cross-page judgment `core/` + tokens/base/dialog-shell**Unnecessary. Remove. components）  
3. **Forbidden** Context missing. Specify target action (e.g., translate, refactor, delete) and scope. import Put back `src/input.css`
4. Add style: check page first. → Write to this domain file → Confirm matched by corresponding `entries/*.css` import  
5. Gatekeeper: `tests/css-page-namespace.test.mjs` (reader/detail Selector prefix)

## Build

```bash
npm run build:css          # → dist/css/{home,detail,reader,reader-legacy}.css
npm run watch:css          # Run entry points in parallel. --watch
```

`scripts/stamp-cache-version.mjs` Paginate. Add `?v=hash` to `dist/css/*.css` referenced in HTML
(`reader-legacy.css` is JS Dynamic injection, generally none. HTML Cite, not participate in stamp).

## Volume (minify later)

| Package | Magnitude | Description |
|----|------|------|
| home | ~175KB | Homepage domain max 100 characters. |
| reader | Default react-pdf Slim package | No Bookshelf/Workflow: No legacy Drawer |
| reader-legacy | Add-on Package | Only `?engine=legacy` |
| detail | ~86KB | Lightest |

Reading page no longer loads `library-view` / `translation-workflow-*` Await homepage rules.

## desktop / button-link

| Symbols | Reference position |
|------|----------|
| `desktop-shell/head/body/dialog` | `dialog-shell.css`Unique constraint. Add to DB schema. `@utility`） |
| `button-link` / `label` / `mono` | `components.utilities.css`（home+detail Share) |
| status-card / app-button / inline-error… | `pages/home/components.utilities.css`Incomplete request. Clarify. home） |
| Download toast | `core/download-toast.css` |

## Related

- `scripts/build-css.mjs` · `scripts/stamp-cache-version.mjs`  
- `src/FEATURES.md` · `frontend/README.md`
