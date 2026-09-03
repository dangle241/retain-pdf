// GlossariesDialog open/close state instance (state/dialog-store.js generic factory,
// mirrors credentials-dialog-store.js). Payload channel is unused by this domain for now,
// kept to match the generic contract for future "open with parameters" use (e.g., opening
// directly to a specific entry from the developer Glossary dropdown).

import { createDialogStore } from "../../state/dialog-store.js";

export function createGlossariesDialogStore() {
  return createDialogStore();
}



