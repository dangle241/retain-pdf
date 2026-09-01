// Tab"Other Actions"——Reading status / Collection / 占位 / Delete.
// 后续导出, Rename等接在books组件内, 不必动其他 tab.

import { ReadingStatusPanel } from "../panels/ReadingStatusPanel.jsx";
import { CollectionsPanel } from "../panels/CollectionsPanel.jsx";
import { DeleteFooterPanel } from "../panels/DeleteFooterPanel.jsx";

/** 占位: 后续接导出 / share等. */
export function BookDetailMorePlaceholder() {
  return (
    <div
      id="book-detail-more-placeholder"
      className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-foreground">Other Actions</p>
      <p className="mt-1 text-xs text-muted-foreground">
        More capabilities will be connected later. This is a placeholder.
      </p>
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.readingStatus
 * @param {string} props.busy
 * @param {(value: string) => void} props.onReadingStatusChange
 * @param {Array} props.collections
 * @param {string} props.collectionsBusy
 * @param {(id: string, next: boolean) => void} props.onToggleCollection
 * @param {string} [props.error]
 * @param {boolean} props.confirmingDelete
 * @param {() => void} props.onDelete
 */
export function BookDetailMoreTab({
  readingStatus,
  busy,
  onReadingStatusChange,
  collections,
  collectionsBusy,
  onToggleCollection,
  error,
  confirmingDelete,
  onDelete,
}) {
  return (
    <div
      className="book-detail-tab-more space-y-5"
      data-book-detail-tab="more"
    >
      <ReadingStatusPanel
        value={readingStatus}
        busy={busy}
        onChange={onReadingStatusChange}
      />
      <CollectionsPanel
        collections={collections}
        collectionsBusy={collectionsBusy}
        onToggle={onToggleCollection}
      />
      <BookDetailMorePlaceholder />
      <DeleteFooterPanel
        error={error}
        confirmingDelete={confirmingDelete}
        busy={busy}
        onDelete={onDelete}
      />
    </div>
  );
}



