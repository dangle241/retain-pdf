// Tab "Translation" ââ migrated from translation-workflow-dialog progress of + Start
// Translation logic updated. UI：BookTranslationWorkflowPanel / BookTranslateProgressPanel。

import { BookTranslationWorkflowPanel } from "../panels/BookTranslationWorkflowPanel.jsx";

/**
 * @param {object} props Pass through to BookTranslationWorkflowPanel business props
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
