// SettingsHubDialog open/close state instance (state/dialog-store.js general factory).
// payload Host "Which activates on open tab" (api/glossary/update), default "api".

import { createDialogStore } from "../../state/dialog-store.js";

export function createSettingsHubDialogStore() {
  return createDialogStore({ tab: "api" });
}
