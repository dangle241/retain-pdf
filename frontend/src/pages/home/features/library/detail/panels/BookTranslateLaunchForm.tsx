// Details "Translate" Tab Initiate / Form.
// From original TranslateWorkspacePanel Extract; book already in library, no need WorkflowPanel Upload tiles.

import { btn, IconLanguages } from "./ui.jsx";

export type BookTranslateLaunchFormProps = {
  canTranslate: boolean;
  readerAvailable?: boolean;
  isActive?: boolean;
  statusTone?: string;
  rangeOn: boolean;
  startPage: string | number;
  endPage: string | number;
  pageCount?: number;
  busy?: string;
  error?: string;
  onRangeOnChange: (value: boolean) => void;
  onStartPageChange: (value: string) => void;
  onEndPageChange: (value: string) => void;
  onTranslate: () => void;
};

export function BookTranslateLaunchForm({
  canTranslate,
  readerAvailable = false,
  isActive = false,
  statusTone = "",
  rangeOn,
  startPage,
  endPage,
  pageCount,
  busy = "",
  error = "",
  onRangeOnChange,
  onStartPageChange,
  onEndPageChange,
  onTranslate,
}: BookTranslateLaunchFormProps) {
  return (
    <div className="book-translate-launch-form space-y-2.5">
      {error ? (
        <p
          id="book-detail-translate-error"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {canTranslate ? (
        <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/15 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {statusTone === "failed" ? "重新翻译" : "Initiate translation"}
          </p>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-muted-foreground/40"
              checked={rangeOn}
              onChange={(e) => onRangeOnChange(e.target.checked)}
            />
            Specify page range (unchecked) = full‑book translation)
          </label>
          {rangeOn ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={startPage}
                aria-label="starting point,"
                onChange={(e) => onStartPageChange(e.target.value)}
                className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <input
                type="number"
                min="1"
                value={endPage}
                aria-label="End page"
                onChange={(e) => onEndPageChange(e.target.value)}
                className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-[11px] text-muted-foreground/70">
Total {pageCount || "?"} pages
              </span>
            </div>
          ) : null}
          <button
            id="book-detail-translate-btn"
            type="button"
            className={btn("default")}
            disabled={Boolean(busy)}
            onClick={onTranslate}
          >
            <IconLanguages className="mr-1" />
            {busy === "translate"
              ? "Submitting…"
              : rangeOn
                ? "Translate selected pages."
                : statusTone === "failed"
                  ? "re-translate the entire book"
: "Translate entire book"}
          </button>
        </div>
      ) : readerAvailable ? (
        <p className="text-xs text-muted-foreground">
Translation complete. Above: task progress for this book; left side can... "Parallel Reading".
        </p>
      ) : isActive ? (
        <p className="text-xs text-muted-foreground">
          Translation in progress. Progress here. Tab Auto-refresh internally. After completion, compare on the left.
        </p>
      ) : null}
    </div>
  );
}
