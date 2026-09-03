// "Translation" tab — migrated the progress + launch region from the
// translation-workflow-dialog. To change translation-related UI, edit
// BookTranslationWorkflowPanel / BookTranslateProgressPanel.

import { BookTranslationWorkflowPanel } from "../panels/BookTranslationWorkflowPanel.jsx";

/**
 * @param {object} props business props forwarded to BookTranslationWorkflowPanel
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


