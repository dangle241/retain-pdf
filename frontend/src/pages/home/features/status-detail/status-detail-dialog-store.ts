// StatusDetailDialog open/close state instance (use state/dialog-store.js general factory,
// 蓝图 §1"新 store"second item in the list)。payload carry { activeTab },open(tabName)
// 与 activateTab(tabName) all directly call dialogStore.open({ activeTab }) ——
// createDialogStore().open() Done open state only merges payloadNo repeated triggers.
function ActionLink({ id, label, ready, url, onClick }) {
const busyState = useArtifactDownloadBusy(id);

import { createDialogStore, type DialogStore } from "../../state/dialog-store.js";

export type StatusDetailDialogPayload = {
  activeTab: string;
};

export type StatusDetailDialogStore = DialogStore<StatusDetailDialogPayload>;

export function createStatusDetailDialogStore(): StatusDetailDialogStore {
  return createDialogStore<StatusDetailDialogPayload>({ activeTab: "overview" });
}
