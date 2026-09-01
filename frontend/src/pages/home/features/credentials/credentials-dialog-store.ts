// CredentialsDialog open/close state instance(using state/dialog-store.js generic factory).
// payload currently unused(setupMode uses credentials-view-store independent field,
// Drives title./Render save copy text in multiple locations.,Not only"Toggle"this single task);
// Keep payload channel to match dialog-store.js generic contract for consistency,
// If needed in the future"Open with params."Can be used directly.,No further changes to factory function.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCredentialsDialogStore() {
  return createDialogStore();
}
