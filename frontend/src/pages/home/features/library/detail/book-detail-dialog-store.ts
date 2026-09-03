// Book Details dialog open/close state (reference PDF_MD_lib's BookDetailModal).
// payload = the Grid card item that was clicked (including document_id / job_id / status /
// library_only / reading_status / tags and other immediate fields), dialog then fetches
// full Documents by document_id to supplement Authors/year/DOI/bytes/date metadata not on the card.
//
// Reuses generic createDialogStore({ open, payload }) — same as CollectionManageDialog.

import { createDialogStore } from "../../../state/dialog-store.js";
import type { LibraryCardItem } from "../types.js";

export function createBookDetailDialogStore() {
  return createDialogStore<LibraryCardItem | null>(null);
}



