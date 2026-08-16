// Tab "Dịch": tiến độ + vùng bắt đầu di chuyển từ translation-workflow-dialog.
// Sửa UI dịch tại BookTranslationWorkflowPanel / BookTranslateProgressPanel.

import { BookTranslationWorkflowPanel } from "../panels/BookTranslationWorkflowPanel.jsx";

/**
 * @param {object} props Props nghiệp vụ truyền qua BookTranslationWorkflowPanel.
 */
export function BookDetailTranslateTab(props) {
  return (
    <div
      className="book-detail-tab-translate space-y-5"
      data-book-detail-tab="translate"
    >
      <BookTranslationWorkflowPanel {...props} />
    </div>
  );
}
