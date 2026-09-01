// BookCard "Translate" action - Standalone module. Modify translation entry here only.
//
// Default: no card. Caller opts in explicitly. concat。
// Display condition: collection untranslated or job Failed, and has document_id + onTranslate.

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import { isLibraryOnlyItem } from "../../../composition/external.js";

export const BOOK_CARD_ACTION_TRANSLATE = "translate";

/**
* @param item Bookshelf item
 * @param handlers onTranslate
* @returns 0 or 1 action
 */
export function buildTranslateBookCardAction(
  item: LibraryCardItem = {},
  { onTranslate }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  if (!documentId || !onTranslate) {
    return [];
  }
  const canTranslate =
    isLibraryOnlyItem(item) || `${item.status || ""}`.trim() === "failed";
  if (!canTranslate) {
    return [];
  }

  return [{
    id: BOOK_CARD_ACTION_TRANSLATE,
label: "Translate",
    icon: "languages",
    className: "book-card-action book-card-action-translate",
    onClick: (_event, current) => {
      onTranslate?.(current);
    },
  }];
}
