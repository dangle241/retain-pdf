// GlossariesDialog open/close state instance (state/dialog-store.js general factory, mirrored
// credentials-dialog-store.js)。payload channel not currently used in this domain,Keep with general contract
// consistent, For future use "open with parameters" (e.g. from developer // Jump directly to a specific glossary entry via dropdown.).

import { createDialogStore } from "../../state/dialog-store.js";

export function createGlossariesDialogStore() {
  return createDialogStore();
}
