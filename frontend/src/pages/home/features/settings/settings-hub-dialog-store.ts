// SettingsHubDialog open/close state instance (state/dialog-store.js generic factory).
// payload carries "which tab to activate on open" (api/glossary/update), default
// "api".

import { createDialogStore } from "../../state/dialog-store.js";

export function createSettingsHubDialogStore() {
  return createDialogStore({ tab: "api" });
}
