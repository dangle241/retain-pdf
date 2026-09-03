// BookCard "Quick read" action — kept in its own module so the read entry
// point only needs edits here.
//
// Behavior:
// - Completed job  -> Side-by-side Reader (onReader(jobId))
// - No job, has document -> Read Source (onReadSource(documentId))
// - Failed and no document -> still returns a button; click is a no-op
//   (keeps older UI / tests working)

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export const BOOK_CARD_ACTION_READ = "read";

/**
 * @param item shelf item
 * @param handlers onReader / onReadSource
 * @returns 0 or 1 actions (currently always 1)
 */
export function buildReadBookCardAction(
  item: LibraryCardItem = {},
  { onReader, onReadSource }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const readerAvailable = `${item.status || ""}`.trim() === "succeeded";

  let label = "Read Source";
  let onClick: BookCardAction["onClick"] = () => {};

  if (readerAvailable && jobId) {
    label = "Side-by-side Reader";
    onClick = () => {
      onReader?.(jobId);
    };
  } else if (documentId) {
    label = "Read Source";
    onClick = () => {
      onReadSource?.(documentId);
    };
  }

  return [{
    id: BOOK_CARD_ACTION_READ,
    label,
    icon: "eye",
    // History test anchor .recent-job-reader
    className: "book-card-action book-card-action-read recent-job-reader",
    onClick,
  }];
}




