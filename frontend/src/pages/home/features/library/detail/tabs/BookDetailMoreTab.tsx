// Tab「其他操作」——阅读状态 / 合集 / 占位 / 删除。
// 后续导出、重命名等接在本组件内，不必动其他 tab。

import { ReadingStatusPanel } from "../panels/ReadingStatusPanel.jsx";
import { CollectionsPanel } from "../panels/CollectionsPanel.jsx";
import { DeleteFooterPanel } from "../panels/DeleteFooterPanel.jsx";

/** 占位：后续接导出 / 分享等。 */
export function BookDetailMorePlaceholder() {
  return (
    <div
      id="book-detail-more-placeholder"
      className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-foreground">其他操作</p>
      <p className="mt-1 text-xs text-muted-foreground">
        更多能力即将接入，这里先占位。
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
