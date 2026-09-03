// BookCard "Translation" action — kept in its own module so the translation entry
// point only needs edits here.
//
// Not attached to the card by default; callers must explicitly concat it.
// Visibility condition: library-only item or job failed, and document_id + onTranslate
// are both available.

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import { isLibraryOnlyItem } from "../../../composition/external.js";

export const BOOK_CARD_ACTION_TRANSLATE = "translate";

/**
 * @param item shelf item
 * @param handlers onTranslate
 * @returns 0 or 1 actions
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
    label: "Translation",
    icon: "languages",
    className: "book-card-action book-card-action-translate",
    onClick: (_event, current) => {
      onTranslate?.(current);
    },
  }];
}




