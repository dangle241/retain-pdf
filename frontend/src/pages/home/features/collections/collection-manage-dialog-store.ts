// CollectionManageDialog open/close state instance of (state/dialog-store.js general factory, mirroring
// glossaries-dialog-store.js). payload = CollectionRecord being edited, or null
// (New mode) ââ open(collection) incoming distinguishes new creation / edit, no extra mode field needed.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCollectionManageDialogStore() {
  return createDialogStore(null);
}
