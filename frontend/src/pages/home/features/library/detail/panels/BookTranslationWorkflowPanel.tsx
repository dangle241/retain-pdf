// 书籍详情「翻译」Tab 的工作流主面板。
//
// 从 TranslationWorkflowDialog 的内容区迁移而来：
//   - 弹窗里：#status-section + StatusCardMain（#job-status-card）
//   - 本 Tab：#book-detail-status-section + StatusCardEmbedded（#book-detail-job-status-card）
//
// 书已在馆：不需要 WorkflowPanel 上传表单；发起翻译用 BookTranslateLaunchForm。
// 进度主场永远在本面板，绝不打开 #translation-workflow-dialog。

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
 * 对应旧弹窗 translation-workflow-shell 中的 status + 动作区，
 * 布局适配详情右栏 Tab。
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

      {/* 迁移自 #status-section / .translation-status-panel */}
      <section
        id="book-detail-status-section"
        className="book-translation-status-panel"
        aria-label="任务进度"
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
