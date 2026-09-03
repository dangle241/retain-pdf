// Left column: cover + Side-by-side / original primary actions.
// Metadata summary (Pages / Size / Added / Collection) was moved to the
// info grid in the Overview tab on the right (BookDetailOverviewTab), so the
// left column is now pure cover + primary action and the right column is no
// longer empty.

import { btn, IconCompare, IconEye } from "./ui.jsx";
import { BookCardProcessingOverlay } from "../../display/BookCardProcessingOverlay.jsx";

/**
 * @param {object} props
 * @param {string} props.coverUrl
 * @param {boolean} props.readerAvailable
 * @param {string} props.documentId
 * @param {string|boolean} props.busy
 * @param {boolean} [props.processing] translation / retry in progress: shows a centered loading overlay on the cover
 * @param {() => void} props.onCompare
 * @param {() => void} props.onReadSource
 */
export function CoverActionsPanel({
  coverUrl,
  readerAvailable,
  documentId,
  busy,
  processing = false,
  onCompare,
  onReadSource,
}) {
  return (
    <div className="sticky top-0 space-y-3">
      <div
        className="relative mx-auto flex aspect-[3/4] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted bg-cover bg-center shadow-[0_10px_26px_color-mix(in_srgb,var(--shadow-color)_14%,transparent)] sm:mx-0 sm:max-w-none"
        style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
        data-cover-processing={processing ? "true" : "false"}
      >
        {coverUrl ? null : <span className="text-xs text-muted-foreground">No cover</span>}
        {processing ? <BookCardProcessingOverlay /> : null}
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {readerAvailable ? (
          <button
            id="book-detail-compare-btn"
            className={btn("default", "w-full")}
            disabled={Boolean(busy)}
            onClick={onCompare}
          >
            <IconCompare className="mr-1" />
            Side-by-side Reader
          </button>
        ) : null}
        <button
          id="book-detail-read-source-btn"
          className={btn(readerAvailable ? "outline" : "default", "w-full")}
          disabled={Boolean(busy) || !documentId}
          onClick={onReadSource}
        >
          <IconEye className="mr-1" />
          View original
        </button>
      </div>
    </div>
  );
}





