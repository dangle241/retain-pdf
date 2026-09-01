import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// HomeApp(Phase 3a:app-shell / upload / workflow Three domains React skeleton)Component-level tests.
// Validation: DOM contract ids exist individually, idle Reset chain drop storeToggle workflow dialog.
// APP_EVENTS contract(Blueprint Risk 5)Error Box setText channel, page range constraints,
// Status area visibility → Dialog mode sync.3b Finalize callback bridge interface.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs(Introduced in Phase B) requires cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle(Presence reads
// animation-name to determine if exit animation ended)ââimplemented on jsdom window, but not
// copied to bare global like requestAnimationFrame, adding it here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");
const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
assert.fail(`Timeout waiting: ${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
// Radix Tabs Trigger activation logic is on onMouseDown(not onClick)ââ
// LibraryTopTabs(Refactor classification)First occurrence in this file. Radix Tabs, add mousedown to
// Simulate click for realistic interaction.(Same as status-detail-dialog-component.test.mjs
  // Precedent exists.),Pure <button> Element unaffected.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

// Control input: Bypass React value track, Use native setter Write then bubble input
function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function createServices() {
  return createHomeComposition({
    fetchGlossaries: async () => ({
      items: [{ glossary_id: "g-1", name: "Glossary A", entry_count: 3 }],
    }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
}

test("HomeApp: Contract id, idle Chain, Workflow Dialog Event Contract and Interaction", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const events = { open: 0, close: 0 };
  dom.window.document.addEventListener(APP_EVENTS.openTranslationWorkflow, () => { events.open += 1; });
  dom.window.document.addEventListener(APP_EVENTS.closeTranslationWorkflow, () => { events.close += 1; });

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
await waitFor(() => byId("app-shell"), "HomeApp first frame render");
// React 18 useSyncExternalStore subscriptions fall into passive effect; first frame DOM
// Submit (above waitFor Lag between fulfillment and subscription activation.ââUnder jsdom
// No act() to automatically flush passive effects. Macro task yielded. Ensure next tick runs.
// dialog/statusArea etc. store Subscription established. Avoid initial interaction before activation.
  // pre-trigger store Missed due to change (manifests as「Open workflow dialog」Wait timeout).
  await wait(0);

// ---- DOM Contract: Top-level + Resident mount blocks exist individually. ----
// Note: "translation-workflow-dialog" and its entire interior job-form family(job-form/
  // ocr_provider/.../status-section/job-status-card)、"app-update-dialog"/
  // "app-update-status"/"app-update-check-btn"、"page-range-dialog"and its contents
// Contract id Item not in list. Check list.ââAfter Phase C(shadcn refactor) TranslationWorkflowDialog/
// SettingsHubDialog/AppUpdateBanner/PageRangeDialog replaced by Radix Dialog, no
// forceMount Content, these ids Mount on respective Content Under the subtree, Only the corresponding dialog box is
// Exists after opening. DOM(Previously native <dialog> or bespoke <div> Persistent mount,
  // Toggle display state only)Move existence checks below. Assert after opening dialogs individually.
  const contractIds = [
    // app-shell
    "app-shell", "developer-btn", "open-output-btn",
// library skeleton(3b placeholder)
    "library-view", "recent-jobs-scroll-body", "recent-jobs-summary", "recent-jobs-empty",
    "library-grid", "recent-jobs-list", "load-more-jobs-btn", "open-query-btn", "library-search-input",
    "library-add-pdf-btn", "app-settings-btn",
  ];
  for (const id of contractIds) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }

// ---- app-update-* Three Contracts id:"app-update-btn" is under SettingsHubDialog
//      Content (TabsPrimitive.Content forceMount makes "Update" tab Panel even if
//      Inactive but still mounted persistently., just hidden), Present upon opening settings dialog.;
  //      "app-update-dialog"/"app-update-status"/"app-update-check-btn" Then
//      AppUpdateBanner's own detail dialog content(After Phase C refactor no
  //      forceMount),Requires one more click"Check for updates"Button mounts only then. ----
  click(byId("app-settings-btn"));
await waitFor(() => byId("app-update-btn"), "After settings dialog opens app-update-btn is mounted");
  click(byId("app-update-btn"));
await waitFor(() => byId("app-update-dialog"), "After clicking Check for updates app-update-dialog is mounted");
  for (const id of ["app-update-status", "app-update-check-btn"]) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }
  services.settingsHub.dialogStore.close();
await waitFor(() => byId("app-update-dialog") === null, "Close settings dialog");

// ---- Open: Add button â dispatch openTranslationWorkflow â Open dialog (First time
//      Open, Mount simultaneously job-form family + job-status-card contract id) ----
assert.equal(byId("translation-workflow-dialog"), null, "Should not be mounted when initially closed");
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Open Workflow Dialog");
  let dialog = byId("translation-workflow-dialog");
  assert.equal(events.open, 1, "Open must pass through. APP_EVENTS.openTranslationWorkflow(3b Refresh Pending Dependencies)");
  assert.equal(dialog.dataset.open, "1");
  assert.equal(dialog.classList.contains("is-upload-mode"), true);
assert.equal(byId("translation-workflow-title").textContent, "Add PDF");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), true);
  await waitFor(() => byId("library-add-pdf-btn").getAttribute("aria-expanded") === "true", "Trigger button aria Sync");
  assert.equal(byId("library-add-pdf-btn").dataset.workflowOpen, "1");

// ---- job-form family + status area placeholder contract id (mounted inside workflow dialog, only exists
//      in DOM after opening) ----
  const workflowContractIds = [
    "translation-workflow-close-btn", "job-warning",
    "job-form", "ocr_provider", "paddle_token", "api_key",
    "file", "upload-fill", "credential-gate", "credential-gate-title", "credential-gate-help", "credential-gate-action",
    "upload-glyph", "file-label", "upload-help", "upload-status", "upload-progress-panel", "upload-progress-text",
    "inline-page-range", "page-range-start", "page-range-end", "translation-budget-note",
    "upload-action-slot", "page-range-btn", "submit-btn", "error-box-inline",
    "status-section", "job-status-card",
  ];
  for (const id of workflowContractIds) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }

// ---- Professional Translation Dialog (PageRangeDialog, Phase C final batch replacement with Radix, no
//      forceMount, mounted in DOM only after being opened): click #page-range-btn to open,
//      contract ids exist one by one, unmounted after close button click. Backdrop click/Esc pure close semantics
//      unified (fixed real bug: previously backdrop click triggered applyPageRanges(), Esc
//      followed another path that only cleared flags, causing inconsistency) verified via fresh Playwright testsâ
//      Radix DismissableLayer outside-pointerdown detection is unreliable under jsdom,
//      following existing test precedents of other migrated dialogs (credentials-dialog-component.test.mjs
//      etc., which also only test mounting/close buttons here, not backdrop/Esc). ----
assert.equal(byId("page-range-dialog"), null, "Should not be mounted when initially closed");
  click(byId("page-range-btn"));
  await waitFor(() => byId("page-range-dialog") !== null, "Open Professional Translation Dialog");
  for (const id of [
    "page-range-title", "page-range-limit-text", "job-glossary-id",
    "page-range-close-btn", "page-range-clear-btn", "page-range-apply-btn",
  ]) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }
  click(byId("page-range-close-btn"));
  await waitFor(() => byId("page-range-dialog") === null, "Unload dialog on close button click.");

// ---- idle reset chain: upload tile returns to default state, submit button disabled ----
assert.equal(byId("file-label").textContent, "Click to select file or drag here");
assert.equal(byId("upload-help").textContent, "éæ© PDF After, translate directly or save to bookshelf.");
  assert.equal(byId("submit-btn").disabled, true);
assert.equal(byId("submit-btn").textContent, "Translate Directly");
  assert.equal(byId("job-warning").classList.contains("hidden"), true);
  assert.equal(byId("status-section").classList.contains("hidden"), true);

// ---- setText("error-box") channel:inline-error-box visibility (dialog still open
//      state, element mounting) ----
services.bridge.setText("error-box", "Upload channel anomaly");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === false, "Error box display");
assert.match(byId("error-box-inline").textContent, /Upload channel anomaly/);
  services.bridge.setText("error-box", "-");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === true, "Error box hidden");

// ---- Page range: Visible after upload state ready., Out-of-bounds input constrained (Dialog remains open) ----
  services.ports.uploadStatePort.setUpload({ uploadId: "u-1", uploadedPageCount: 10 });
  services.features.uploadFeature.renderPageRangeSummary();
  await waitFor(() => byId("inline-page-range").classList.contains("hidden") === false, "Page range display");
  typeInput(byId("page-range-start"), "99");
  await waitFor(() => byId("page-range-start").value === "10", "Start page constrained to total page count.");

// ---- Status area visibility â Dialog mode sync (statusAreaVisibilityChanged contract,
//      dialog remains open throughout, no need to click "Add" again) ----
  services.bridge.setWorkflowSections({ job_id: "job-1", status: "running" });
  await waitFor(() => byId("status-section").classList.contains("hidden") === false, "status area displays");
  await waitFor(() => dialog.classList.contains("is-status-mode"), "Switch Dialog to State Mode");
assert.equal(byId("translation-workflow-title").textContent, "Task Progress");
  services.bridge.setWorkflowSections(null);
  await waitFor(() => byId("status-section").classList.contains("hidden") === true, "statusBar hide. Unnecessary UI element. Remove: `document.getElementById('statusBar').style.display = 'none';` → skipped: conditional show, add when needed.");
  await waitFor(() => dialog.classList.contains("is-upload-mode"), "Dialog back to upload mode");

// ---- In status mode, clicking Ã = close directly in one click (no longer two-stage: no returnHome, no
//      bounce back to upload form; task cancellation handled by StatusCard's "Cancel Task" button) ----
  services.bridge.setWorkflowSections({ job_id: "job-2", status: "running" });
  await waitFor(() => dialog.classList.contains("is-status-mode"), "Back to State Mode");
  let returnHomeCount = 0;
  dom.window.document.addEventListener(APP_EVENTS.returnHome, () => { returnHomeCount += 1; });
  const closesBefore = events.close;
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Click the × in status mode directly closes the dialog × dialog.close() → skipped: animation, add when needed.");
  assert.equal(returnHomeCount, 0, "Status mode closed. Do not proceed. returnHome(Two-phase commit deprecated.)");
  assert.equal(events.close, closesBefore + 1, "State mode should be closed. dispatch once closeTranslationWorkflow");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), false);

// ---- Escape close path (reopen â Escape, verify Escape also works in one go, and via
//      closeTranslationWorkflow event, 3b library refresh restores dependencies) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Reopen(Uploading)");
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Escape Close");
  assert.equal(events.close, closesBefore + 2, "Escape Close requires approval. APP_EVENTS.closeTranslationWorkflow");

// ---- Close button path (use close button after reopening; also verify openUpload session reset) ----
  click(byId("library-add-pdf-btn"));
await waitFor(() => byId("translation-workflow-dialog") !== null, "Reopen");
// openUpload will reset upload session (uploadId cleared)
  assert.equal(services.ports.uploadStatePort.getSnapshot().uploadId, "");
  dialog = byId("translation-workflow-dialog");
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Close dialog");
  assert.equal(events.close, closesBefore + 3);

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeAppTop Library/Collections/Favorites Column + Category Management", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root-categories";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
await waitFor(() => byId("app-shell"), "HomeApp first frame render");
  await wait(0);

// ---- Column contract: four tabs present, default to library ----
assert.ok(byId("library-top-tab-library"), "Contract ID missing: #library-top-tab-library");
assert.ok(byId("library-top-tab-categories"), "Contract ID missing: #library-top-tab-categories");
assert.ok(byId("library-top-tab-favorites"), "Contract ID missing: #library-top-tab-favorites");
assert.ok(byId("library-top-tab-ask"), "Contract ID missing: #library-top-tab-ask");
  assert.ok(byId("library-view"), "Default to library view.");
  assert.equal(byId("categories-view"), null, "Do not mount collection view by default");
  assert.equal(byId("favorites-view"), null, "Favorites view unmounted by default.");
  assert.equal(byId("home-ask-view"), null, "Not mounted by default AI Q&A View");
assert.ok(byId("library-search-input"), "Library tab Search box must be visible");

// ---- Switch to collections: library grid unmounts, collection view mounts, search box hidden ----
  click(byId("library-top-tab-categories"));
  await waitFor(() => byId("categories-view") !== null, "Mount Collection View");
  assert.equal(byId("library-view"), null, "Library view should unmount after switching to collection.");
assert.equal(byId("favorites-view"), null, "Collections tab Unmount favorites view.");
assert.equal(byId("library-search-input"), null, "Collections tab search box should be hidden");
assert.ok(byId("categories-create-btn"), "Contract ID missing: #categories-create-btn");

// ---- New collection dialog: mount/contract ID/unmount on close ----
assert.equal(byId("collection-manage-dialog"), null, "Not mounted when initially closed");
  click(byId("categories-create-btn"));
  await waitFor(() => byId("collection-manage-dialog") !== null, "Collection Management Dialog Open");
  for (const id of ["collection-name-input", "collection-manage-close-btn", "collection-save-btn"]) {
assert.ok(byId(id), Contract id missing: #${id});
  }
  assert.equal(byId("collection-delete-btn"), null, "New mode should not have a delete button.");
  click(byId("collection-manage-close-btn"));
await waitFor(() => byId("collection-manage-dialog") === null, "Dialog unmounts after close button click");

// ---- Switch to favorites: collection unloaded, favorites view mounted, search box still hidden ----
  click(byId("library-top-tab-favorites"));
  await waitFor(() => byId("favorites-view") !== null, "Mount Favorites View");
  assert.equal(byId("categories-view"), null, "Switch to favorites: unload collection view.");
assert.equal(byId("library-view"), null, "Favorites tab Uninstall library view");
assert.equal(byId("library-search-input"), null, "Search box should be hidden in Favorites tab");
// One of loading / empty / list / error
  await waitFor(
    () => byId("favorites-loading") || byId("favorites-empty") || byId("favorites-list") || byId("favorites-error"),
"Enter favorites view loading/empty/list/One of the errors.",
  );

// ---- Switch to AI Q&A: favorites unloaded, AI view mounted ----
  click(byId("library-top-tab-ask"));
  await waitFor(() => byId("home-ask-view") !== null, "AI Q&A view mount");
  assert.equal(byId("favorites-view"), null, "AI tab Uninstall download view.");
assert.equal(byId("library-view"), null, "Library view should be unmounted in AI tab");
assert.equal(byId("library-search-input"), null, "Search box should be hidden in AI tab");

// ---- Switch back to library: favorites/AI unloaded, library grid and search box restored ----
  click(byId("library-top-tab-library"));
  await waitFor(() => byId("library-view") !== null, "Back to Library");
  assert.equal(byId("categories-view"), null, "After switching back to library, collection view should be unloaded.");
  assert.equal(byId("favorites-view"), null, "Unload favorites view on library return.");
  assert.equal(byId("home-ask-view"), null, "After returning to the library AI View should unmount");
  assert.ok(byId("library-search-input"), "Search box should be restored when switching back to library.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeAppCategory management dialog: quick edit target switch not overwritten by delayed responses. (Regression)", async () => {
// Regression coverage: CollectionManageDialog's open-effect previously had no cancelled guard——
// Quickly open dialog for A, close, then open for B, if A's network request arrives later than B's
// resolve (out-of-order which is entirely possible under real network) would overwrite the checkbox state of the form currently displaying B
// Overwrite back to A's old data. Reproduce this out-of-order with a fake controller having controllable resolve order.
  const host = dom.window.document.createElement("div");
  host.id = "home-root-race";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const memberResolvers = {};
  function deferredMemberIds(collectionId) {
    return new Promise((resolve) => {
      memberResolvers[collectionId] = resolve;
    });
  }
  services.collections.controller.listAllDocuments = () => Promise.resolve([
    { document_id: "doc-1", title: "Doc One" },
  ]);
  services.collections.controller.listCollectionDocumentIds = (collectionId) => deferredMemberIds(collectionId);

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
await waitFor(() => byId("app-shell"), "HomeApp first frame render");
  await wait(0);

  const dialogStore = services.collections.dialogStore;

  dialogStore.open({ collection_id: "col-a", name: "A" });
await waitFor(() => byId("collection-manage-dialog") !== null, "Open A");
  await wait(0);

  dialogStore.close();
  await wait(0);
  dialogStore.open({ collection_id: "col-b", name: "B" });
  await waitFor(() => byId("collection-name-input")?.value === "B", "Switch to B");
  await wait(0);

// Out-of-order resolve: B (doc-1 does not belong to B) arrives first, A (doc-1 belongs to A) arrives later.
  memberResolvers["col-b"]([]);
  await wait(10);
  const checkboxAfterB = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
assert.equal(checkboxAfterB.checked, false, "B Book list checkbox should be unchecked. (doc-1 does not belong to B)");

  memberResolvers["col-a"](["doc-1"]);
  await wait(10);
  const checkboxAfterLateA = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterLateA.checked, false, "A The late response should not B Checked state overrides to checked.");
  assert.equal(byId("collection-name-input").value, "B", "Form title should still be B,not affected by A Late response throws off.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp: 3b callback bridge interface finalized (Blueprint Â§4)", () => {
  const services = createServices();
// Callback names required for wiring mountJobRuntimeFeature / status-detail / credentials
  const bridgeContract = [
    "setText",
    "setWorkflowSections",
    "setLinearProgress",
    "updateActionButtons",
    "renderPageRangeSummary",
    "resetUploadProgress",
    "resetUploadedFile",
    "applyWorkflowMode",
    "updateJobWarning",
    "resetEventsList",
    "activateDetailTab",
    "setSubmitBusy",
    "submitForm",
  ];
  for (const name of bridgeContract) {
assert.equal(typeof services.bridge[name], "function", `bridge.${name} missing`);
  }
// 3b workflow-open-port injection point
  assert.equal(typeof services.workflowDialog.isOpen, "function");
  assert.equal(services.workflowDialog.isOpen(), false);
  services.dispose();
});
