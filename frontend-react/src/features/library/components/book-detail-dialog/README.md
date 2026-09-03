# Book Detail Dialog Component family

## Boundary

`book-detail-dialog` Book detail popup displays summary buttons task status. No data loading download calls./read API。

## Files

- `book-detail-dialog.tsx`Popup overlay. Simplify: Use CSS z-index. Add when multiple overlays needed.
- `book-detail-config.ts`：tab Define layout dimensions for this component family.
- book-detail-selectors.ts: move LibraryBook into the detail popup's view model.
- `book-detail-cover-panel.tsx`Left cover area.
- `book-detail-heading.tsx`Title and author.
- `book-detail-tabs.tsx`Details, Translation, Files, Progress tab Combination layer.
- book-detail-overview-panel.tsx: composition layer for the Details tab.
- `book-detail-fields.tsx`Page count, status, last updated.
- book-detail-translation-panel.tsx: composition layer for the translation tab.
- `book-detail-field-list.tsx`: Generic label-value list for detail fields label-value List.
- `book-detail-translation.tsx`Translation task configuration summary.
- book-detail-artifacts.tsx: original PDF, PDF against PDF, and other file artifacts.
- book-detail-artifacts-panel.tsx: composition layer for the Files tab.
- `book-detail-artifact-row.tsx`: single file artifact row.
- `book-detail-progress-summary.tsx`Concise task progress summary for detail popup.
- `book-detail-section.tsx`Common section inside detail popup.
- `book-detail-actions.tsx`Side-by-side reading and download.
- `book-detail-status-panel.tsx`: Right-side task progress area.
- book-detail-types.ts: shared internally within this component family. Props types.
- index.ts: public export for the component family.

## Rules

- External only `BookDetailDialog`。
- Product copy from `library-config.ts`。
- Fixed layout dimensions from `book-detail-config.ts`Do not scatter across multiple locations. `.tsx` In.
- Complex data derivation at `book-detail-selectors.ts`display component only accepts simple props。
- `BookDetailDialog` Only allowed recipient. `LibraryBook` component entry of.
- BookDetailTabs and internal tab components receive BookDetailViewModel or smaller props, not directly dependent on LibraryBook.
- Use lightweight inside detail popup. `BookDetailProgressSummary`Do not embed the full task page card directly.
- real action callbacks are passed from `BookDetailDialog` props Pass in, then forward to internal action components.
- Book Details, Task Progress, Download/Keep read actions in separate files. Prevents composition layer thickening.
- Popup content passed. tabs Partition: when adding features, add new partitions first. tab Internal component. Do not directly place content into it. `book-detail-dialog.tsx`。
