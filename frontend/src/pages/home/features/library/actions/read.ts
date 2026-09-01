// BookCard「Skim」Action —— Standalone module. Modify reading logic in this file only.
//
// Behavior:
// - Completed job â Parallel reading (onReader(jobId))
// - Otherwise there is document â Read original (onReadSource(documentId))
// - Failed and none document → Still return button, click no-opCompatibility with legacy UI/Test)

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export const BOOK_CARD_ACTION_READ = "read";

/**
 * @param item Bookshelf item
 * @param handlers onReader / onReadSource
* @returns 0 or 1 action (currently always 1)
 */
export function buildReadBookCardAction(
  item: LibraryCardItem = {},
  { onReader, onReadSource }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const readerAvailable = `${item.status || ""}`.trim() === "succeeded";

  let label = "Read original.";
  let onClick: BookCardAction["onClick"] = () => {};

  if (readerAvailable && jobId) {
label = "Parallel reading";
    onClick = () => {
      onReader?.(jobId);
    };
  } else if (documentId) {
label = "Read original";
    onClick = () => {
      onReadSource?.(documentId);
    };
  }

  return [{
    id: BOOK_CARD_ACTION_READ,
    label,
    icon: "eye",
    // Historical test anchor .recent-job-reader
    className: "book-card-action book-card-action-read recent-job-reader",
    onClick,
  }];
}
