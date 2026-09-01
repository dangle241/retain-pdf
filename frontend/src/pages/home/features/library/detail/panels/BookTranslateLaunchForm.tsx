// 详情"Translation"Tab: 发起 / Translate Again表单.
// 从原 TranslateWorkspacePanel 抽出；书已在馆, None需 WorkflowPanel Upload瓦片.

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
            {statusTone === "failed" ? "Translate Again" : "Start translation"}
          </p>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-muted-foreground/40"
              checked={rangeOn}
              onChange={(e) => onRangeOnChange(e.target.checked)}
            />
            指定pages码Scope(不勾选 = 整booksTranslation)
          </label>
          {rangeOn ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={startPage}
                aria-label="Start page"
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
                total {pageCount || "?"} pages
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
              ? "Submitting..."
              : rangeOn
                ? "Translate selected pages"
                : statusTone === "failed"
                  ? "Translate Again整books"
                  : "Translation整books"}
          </button>
        </div>
      ) : readerAvailable ? (
        <p className="text-xs text-muted-foreground">
          TranslatedDone.上方为books书Job Progress；左侧可"Side-by-side Reader".
        </p>
      ) : isActive ? (
        <p className="text-xs text-muted-foreground">
          TranslationIn progress, Progress在books Tab 内自动刷新.Done后可在左侧Side-by-side Reader.
        </p>
      ) : null}
    </div>
  );
}





