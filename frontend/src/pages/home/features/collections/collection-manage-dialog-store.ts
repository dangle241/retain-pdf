// CollectionManageDialog open/close state instance (state/dialog-store.js generic
// factory, mirroring glossaries-dialog-store.js). payload = CollectionRecord being edited,
// or null (new mode) — open(collection) passed in distinguishes new/edit without needing
// an extra mode field.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCollectionManageDialogStore() {
  return createDialogStore(null);
}


