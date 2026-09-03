# Home ↔ Reader: close without refreshSoft Reader）

**Date:** 2026-07-21
**Scope:** `frontend` Open homepage PDF Read, close, return to shelf.
**Status:** Implemented

---

## 1. Phenomenon

1. Reader entry missing top-right corner. Check CSS: `.reader-header .menu` display none. Fix: remove `display: none`. "Close / Back to Home".
2. After closing: click Ã will **full page refresh** Home, Bookshelf**Scroll position lost**.
3. User expects: close reader, shelf returns immediately.**Do not reopen website.**。

---

## 2. Background evolution

| Stage | Solution | Issue |
|------|------|------|
| A | Home Radix Dialog + **iframe** embed `reader.html` | Dual-document lifecyclepostMessageStyling duplication, prone to becoming.「Small popup」 |
| B | Homepage `location.assign(reader.html)` Full-page navigation | Close only `history.back` / then `assign(index.html)` Homepage uninstalled.**Inevitable reload sensation** |
| CCurrent. | **Soft Reader**home page not unloaded + Fullscreen reading layer | Close Ã No refresh, scroll persists; address bar remains `reader.html?â¦` |

users explicitly dislike "Wrap dialog iframe shell" Acceptable.**Avoid refreshing homepage.**fullscreen host layer use. Simplify: remove if not needed. iframe load full reader â skipped: optional, add when needed SPA, **None** dialog Floating window)

---

## 3. Root cause

### 3.1 Why「Refresh」

```
Home index.html  ──location.assign──►  reader.html
       ▲                                    │
       └──────── assign(index) / back ──────┘
```

- `assign` When leaving the homepage,**Homepage docs destroyed.**（React Tree, scroll container, polling status all missing.
- Apply on close `history.back()`：
- With **bfcache** Time: may recover instantly (polling etc. in this project often cause bfcache **Unstable**);
- Without bfcache browser**Reload** `index.html` â User perceives refresh.
- Bookshelf scrolling in `#recent-jobs-scroll-body`Not enough context. Need source text. `window`), browser also won't after hard reload**not** Auto-restore this element `scrollTop`.

### 3.2 Why sessionStorage Rollback insufficient

Already added.「Save scroll on exit, restore on return.」：

- Mitigates**Force return to home page**Position lost.
- **Cannot eliminate.**White screen. / React Cold start refresh feel.

To「No refresh」Must keep**Homepage docs persist.**。

---

## 4. Solution missing. Provide details.Soft Reader(soft open)

### 4.1 Approach

From **Homepage docs** On opening reading mode:

1. **Do not** `location.assign` Uninstall homepage;
2. `history.pushState` change the address to `reader.html?job_id=…`(Shareable, refresh still enters actual reading page);
3. Overlay homepage. **Fullscreen host**（`SoftReaderHost`（ `iframe[src=reader.html?…]` run full reader;
4. Homepage DOM(including `#recent-jobs-scroll-body`) **Always retain**.

On close:

1. Reader (iframe in)`postMessage` Notify parent page.
2. Parent page `history.back()` Uninstall soft Layer;
3. Home page exposed immediately.**Reload without navigation**。

```
┌──────────── index.html(always alive)────────────┐
â  Bookshelf / Collection / Favorites â¦  scroll retained             â
│  ┌──────── SoftReaderHost (fixed Full screen) ─────┐ │
│  │  iframe → reader.html + reader.bundle    │ │
â  â  [Ã Close] â postMessage â history.back   â â
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

### 4.2 Key Files

| Path | Responsibility |
|------|------|
| `frontend/src/shared/navigation/soft-reader.ts` | `trySoftOpenReader` / `closeSoftReaderOnHost`、history stateMessage type |
| `frontend/src/shared/navigation/home-return-state.ts` | Scroll before leaving/tab Snapshot (hard redirect fallback) |
| `frontend/src/pages/home/features/reader/navigate-to-reader.ts` | Default soft open; `replace` Jump anyway |
| `frontend/src/pages/home/features/reader/SoftReaderHost.tsx` | Fullscreen layer + iframe + popstate / message |
| `frontend/src/pages/home/features/reader/ReaderDialog.tsx` | listen `openReaderRequested` → `navigateToReader` |
| `frontend/src/pages/reader/components/react-pdf/ReaderCloseHome.tsx` | Ã: postMessage within iframe Standalone page back/assign |
| `frontend/src/pages/home/features/library/page/useHomeReturnRestore.ts` | Restore scrolling on hard back to home (fallback) |
| `frontend/src/styles/pages/home/library-shell.css` | `.soft-reader-host` / `.soft-reader-frame` |

### 4.3 Open path (homepage click book)

```
openReaderRequested
  → ReaderDialog
  → navigateToReader(url)
  → captureHomeReturnState({ allowBack: true })
  → trySoftOpenReader(url)          // Homepage docs
       history.pushState({ retainpdfSoftReader, readerUrl }, "", absoluteUrl)
       dispatch retainpdf:soft-reader-open
  → SoftReaderHost Show iframe
```

only if**Not homepage doc**(already in `reader.html` / `detail.html`) or soft On failure, only `location.assign`.

Deep link `?view=reader&job_id=` Still in use **`replace: true` Force push** `reader.html`(avoid history Infinite loop).

### 4.4 Close Path

**A. soft open fail. Check permissions.iframe )**

```
Click ×
  → navigateReaderToHome()
  → parent.postMessage({ type: "retainpdf:soft-reader-close" }, origin)
â parent page closeSoftReaderOnHost()
  → history.back()
  → SoftReaderHost popstate → unload iframe
  → Homepage intact. Scroll not moving.
```

**B. Standalone `reader.html`Bookmark / After refresh)**

```
× → history.back()(if session Mark as from homepage)
or location.assign(index.html)
  + useHomeReturnRestore Restore scrolling
```

### 4.5 Difference from "Old iframe Dialog"

| | Old Dialog+iframe | Soft Reader |
|--|------------------|-------------|
| Shell | Radix Dialog, easily becomes a small window | `position:fixed; inset:0` Toggle fullscreen mode. Check browser settings. |
| Homepage | Constant still exists, but shell./Heavy style coupling. | clearly define "Homepage keep-alive" Product targets set. |
| Communication | Progress. postMessage Wait for batch | **Close only** One close message |
| URL | Mostly homepage URL | **pushState Done reader URL** |
| Refresh Reading URL | May still be on homepage. | Open actual `reader.html` |

---

## 5. Scenario matrix

| Scenario | Behavior |
|------|------|
| Homepage card click / Comparative reading â Read â Close Ã | Soft open, **no refresh** Scroll retain |
| Browser "Back" | Same as soft close |
| Open directly from address bar. / Refresh `reader.html` | Standalone Reading Page× Returning to home may reload entire page (acceptable). |
| Homepage `?view=reader&job_id=` | `replace` Force Enter Reading |
| Open cross-page link within reading page. | Continue using the reader's built-in navigation. |

---

## 6. Build and verify

```bash
cd frontend
npm run build:css
npm run build:js
# Hard refresh browser. Test homepage. â Read â Close
```

Manual testing recommended.

1. Scroll homepage bookshelf down one section.
2. Open a book.
3. Click top-right "Close";
4. Bookshelf appears instantly.**No blank screen on reload.**Scroll position persists.

Related tests (navigation contract, multi-use mock navigate):

- `frontend/tests/reader-dialog-component.test.mjs`
- `frontend/tests/home-app-component.test.mjs`

---

## 7. Optional later

- Soft layer loading Mask (iframe Avoid blank flash before first package.
- Improved scroll restoration when closing standalone reading page. / bfcache Friendly (stop polling at `pagehide`）。
- If the product allows.「Same-package embedding `ReaderAppReactPdf`」Removable iframe, further reduce double bundlethe cost is home bundle Size increased.

---

## 8. One sentence.

**Reader no-refresh root: avoid full-page nav unloading home; use history + Keep fullscreen layer alive on homepage; reader continues full execution. `reader.html`。**
