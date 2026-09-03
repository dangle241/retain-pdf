// Workflow main panel for the Book Details "Translation" tab.
//
// Migrated from the content area of TranslationWorkflowDialog:
//   - Inside the dialog: #status-section + StatusCardMain (#job-status-card)
//   - On the book tab:    #book-detail-status-section + StatusCardEmbedded (#book-detail-job-status-card)
//
// Books already in the library do not need the upload form on the workflow
// panel; starting translation goes through BookTranslateLaunchForm.
// Progress always lives on the book panel; never open #translation-workflow-dialog
// for an already-tracked book.

import { cn } from "@/lib/utils";
import { BookTranslateProgressPanel } from "./BookTranslateProgressPanel.jsx";
import { BookTranslateLaunchForm } from "./BookTranslateLaunchForm.jsx";
import type { LibraryCardItem } from "../../types.js";

export type BookTranslationWorkflowPanelProps = {
  item?: LibraryCardItem;
  status: { label: string; tone: string };
  canTranslate: boolean;
  readerAvailable?: boolean;
  isActive?: boolean;
  tabActive?: boolean;
  dialogOpen?: boolean;
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

/**
 * Corresponds to the status + actions area inside the old
 * translation-workflow-shell; layout adapted to the detail dialog's right column.
 */
export function BookTranslationWorkflowPanel({
  item = {},
  status,
  canTranslate,
  readerAvailable = false,
  isActive = false,
  tabActive = true,
  dialogOpen = true,
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
}: BookTranslationWorkflowPanelProps) {
  const toneText =
    status.tone === "done"
      ? "text-foreground"
      : status.tone === "active"
        ? "text-primary"
        : status.tone === "failed"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div
      className="book-translation-workflow space-y-4"
      data-book-translation-workflow="true"
    >
      <div className="flex items-center gap-2">
        <span className={cn("book-detail-status text-sm font-medium", toneText)}>
          {status.label}
        </span>
      </div>

      {/* Migrated from #status-section / .translation-status-panel */}
      <section
        id="book-detail-status-section"
        className="book-translation-status-panel"
        aria-label="Job Progress"
      >
        <BookTranslateProgressPanel
          item={item}
          active={tabActive}
          dialogOpen={dialogOpen}
        />
      </section>

      <BookTranslateLaunchForm
        canTranslate={canTranslate}
        readerAvailable={readerAvailable}
        isActive={isActive}
        statusTone={status.tone}
        rangeOn={rangeOn}
        startPage={startPage}
        endPage={endPage}
        pageCount={pageCount}
        busy={busy}
        error={error}
        onRangeOnChange={onRangeOnChange}
        onStartPageChange={onStartPageChange}
        onEndPageChange={onEndPageChange}
        onTranslate={onTranslate}
      />
    </div>
  );
}




