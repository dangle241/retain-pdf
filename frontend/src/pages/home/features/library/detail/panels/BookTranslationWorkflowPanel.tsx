// Bảng workflow chính của tab "Dịch" trong chi tiết sách.
//
// Di chuyển từ vùng nội dung TranslationWorkflowDialog:
//   - Trong hộp thoại: #status-section + StatusCardMain (#job-status-card)
//   - Trong tab này: #book-detail-status-section + StatusCardEmbedded (#book-detail-job-status-card)
//
// Sách đã trong thư viện: không cần biểu mẫu tải lên WorkflowPanel; bắt đầu dịch bằng BookTranslateLaunchForm.
// Tiến độ chính luôn ở bảng này, không bao giờ mở #translation-workflow-dialog.

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
 * Tương ứng vùng status + hành động trong translation-workflow-shell cũ,
 * bố cục thích ứng tab cột phải của chi tiết.
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

      {/* Di chuyển từ #status-section / .translation-status-panel. */}
      <section
        id="book-detail-status-section"
        className="book-translation-status-panel"
        aria-label="Tiến độ tác vụ"
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
