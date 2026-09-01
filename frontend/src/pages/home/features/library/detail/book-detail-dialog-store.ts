// Book details modal open/close state (Reference PDF_MD_lib BookDetailModal).
// payload = the grid card that was clicked to open item (contains document_id / job_id / status /
// library_only / reading_status / tags and other immediate fields),Press again for popup document_id Pull once.
// Add author to complete docs./Year/DOI/Byte/Metadata absent from date cards.
//
// Reuse Common createDialogStore({ open, payload }) - same as CollectionManageDialog.

import { createDialogStore } from "../../../state/dialog-store.js";
import type { LibraryCardItem } from "../types.js";

export function createBookDetailDialogStore() {
  return createDialogStore<LibraryCardItem | null>(null);
}
