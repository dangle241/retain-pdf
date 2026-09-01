// Tab「翻译」——迁移自 translation-workflow-dialog 的进度 + 发起区。
// 改翻译相关 UI：BookTranslationWorkflowPanel / BookTranslateProgressPanel。

import { BookTranslationWorkflowPanel } from "../panels/BookTranslationWorkflowPanel.jsx";

/**
 * @param {object} props 透传给 BookTranslationWorkflowPanel 的业务 props
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
