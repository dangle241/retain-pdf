// CredentialsDialog open/close state instance (using state/dialog-store.js generic factory).
// payload is currently unused (setupMode goes through credentials-view-store's independent
// field, because it drives Title/Save copy in multiple rendering spots, not just "open/close");
// keeping the payload channel to stay consistent with dialog-store.js's generic contract,
// future "open with parameters" use can leverage it directly without modifying the factory.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCredentialsDialogStore() {
  return createDialogStore();
}



