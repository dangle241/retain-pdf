// StatusDetailDialog open/close state instance (using state/dialog-store.js generic factory,
// blueprint §1 "new store" list second item). payload carries { activeTab }; open(tabName)
// and activateTab(tabName) both directly call dialogStore.open({ activeTab }) —
// createDialogStore().open() on already-open state only merges payload, does not re-trigger
// showModal (StatusDetailDialog.jsx's effect only calls showModal when open goes false→true),
// so "open with tab specified" and "switch tab after open" can reuse the same method.

import { createDialogStore, type DialogStore } from "../../state/dialog-store.js";

export type StatusDetailDialogPayload = {
  activeTab: string;
};

export type StatusDetailDialogStore = DialogStore<StatusDetailDialogPayload>;

export function createStatusDetailDialogStore(): StatusDetailDialogStore {
  return createDialogStore<StatusDetailDialogPayload>({ activeTab: "overview" });
}


