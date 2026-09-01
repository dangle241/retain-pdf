import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// StatusDetailDialog (Phase 3 dialogs group, Blueprint Â§1) component-level test. Covers Blueprint Â§1.4
// Add test checklist: 4 tab switching + hidden Property contract overview First-screen placeholder.âRefresh two-pass rendering.
// StageHistoryList/EventsList Assert each item. (Replace object array assertions with markup assertions),
// TranslationDebugTab filtering/paging/selection/Replay loop. rerun Success path + startPolling
// Joint debug. Use real data. mountJobRuntimeFeature polling chain (?mock=failed / ?mock=done),
// Do not mock fetchâAll status-detail exclusive fetch(diagnostics/resume-plan/
// translation/*) Route to built-in modules. isMockMode() branch (mirrors
// makeDom Precedent in status-card-component.test.mjs).

function makeDom(search) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (introduced in Phase B) requires cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended)âimplemented on jsdom window, but not
// copied to bare global like requestAnimationFrame; adding it here. NodeFilter
// is a new requirement for Phase C (StatusDetailDialog replaced by Radix Dialog)âDialog.Content's
// FocusScope uses it for focusable element tree traversal (@radix-ui/react-focus-scope's
// getTabbableCandidates), not required by Tabs.
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

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
assert.fail(`Wait timeout: ${description}`);
}

function click(dom, element) {
// Radix Tabs Trigger activation logic is on onMouseDown (not onClick)âPhase B
// After migrating to Radix Tabs (StatusDetailDialog 4 tabs), dispatching only "click" will not
// trigger tab switching. Real browser clicks are mousedownâmouseupâclick; here
// add mousedown to make simulated clicks closer to real interaction, without relaxing assertions.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(dom, element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function selectOption(dom, element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function byId(dom, id) {
  return dom.window.document.getElementById(id);
}

async function bootHomeApp(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../src/pages/home/composition.js");
  const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
await waitFor(() => byId(dom, "library-add-pdf-btn"), "HomeApp first frame render");
// Phase C (shadcn refactor): TranslationWorkflowDialog replaced by Radix Dialog, so no
// forceMount Contentâjob-status-card is embedded in this dialog and only mounts when the dialog has been opened
// (following the precedent of Phase C first-batch dialogs like CredentialsDialog).
// openStatusDetailDialog()'s startPolling depends on job-status-card related
// statusCardStore consumer being ready; open workflow dialog once first to ensure mounting.
  services.workflowDialog.openUpload();
await waitFor(() => byId(dom, "job-status-card"), "job-status-card mounted after workflow dialog opens");
  await wait(0);

  return { services, root, host };
}

async function openStatusDetailDialog(dom, services) {
  const { getMockJobId } = await import("../src/js/mock/index.js");
  services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-detail-btn"), "Status card detail button ready");
  click(dom, byId(dom, "status-detail-btn"));
// Phase C (shadcn refactor): StatusDetailDialog replaced by Radix Dialog, so no forceMount
// Contentânot mounted when dialog is closed; assertions changed from "open attribute" to "is mounted" (following
// the precedent of Phase C first-batch dialogs like CredentialsDialog).
await waitFor(() => byId(dom, "status-detail-dialog") !== null, "Detail dialog opened");
  return getMockJobId();
}

test("StatusDetailDialog: 4 tab switching + hidden Attribute Contract (Permanent Mount, No Unmount)", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);

  const contractIds = [
    "status-detail-dialog", "status-detail-head-icon", "status-detail-job-id",
    "status-detail-head-note", "status-detail-close-btn",
    "detail-tab-overview", "detail-tab-failure", "detail-tab-events", "detail-tab-translation",
    "detail-panel-overview", "detail-panel-failure", "detail-panel-events", "detail-panel-translation",
  ];
  for (const id of contractIds) {
assert.ok(byId(dom, id), `Contract ID missing: #${id}`);
  }

// Opens to overview by default; other three panels are hidden via hidden attribute (not unmounted).
  assert.equal(byId(dom, "detail-tab-overview").getAttribute("aria-selected"), "true");
  assert.equal(byId(dom, "detail-panel-overview").hidden, false);
  assert.equal(byId(dom, "detail-panel-failure").hidden, true);
  assert.equal(byId(dom, "detail-panel-events").hidden, true);
  assert.equal(byId(dom, "detail-panel-translation").hidden, true);

  click(dom, byId(dom, "detail-tab-failure"));
await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "Switch to failure tab");
  assert.equal(byId(dom, "detail-tab-failure").getAttribute("aria-selected"), "true");
  assert.equal(byId(dom, "detail-tab-overview").getAttribute("aria-selected"), "false");
assert.equal(byId(dom, "detail-panel-overview").hidden, true, "Overview panel hidden but still in DOM (not unmounted)");
assert.ok(byId(dom, "runtime-current-stage"), "Overview panel node still exists in DOM (hidden is not unmount)");

  click(dom, byId(dom, "detail-tab-events"));
await waitFor(() => byId(dom, "detail-panel-events").hidden === false, "Switch to events tab");

  click(dom, byId(dom, "detail-tab-translation"));
await waitFor(() => byId(dom, "detail-panel-translation").hidden === false, "Switch to advanced diagnostics tab");

  click(dom, byId(dom, "detail-tab-overview"));
await waitFor(() => byId(dom, "detail-panel-overview").hidden === false, "Switch back to overview tab");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：overview first screen placeholder (sync)→ Refresh two-stage rendering (asynchronously populate diagnostic fields)", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);

// At the moment of opening (within sync chain), job-id is already a placeholder snapshot from currentJobStore, not blank.
  assert.notEqual(byId(dom, "status-detail-job-id").textContent.trim(), "-");
  assert.notEqual(byId(dom, "status-detail-job-id").textContent.trim(), "");

// Diagnostic summary comes from exclusive fetchJobDiagnostics (a second async fetch separate from polling snapshot),
// mock branch returns fixed textâonly appears in failure tab after ensureOverviewData's fresh fetch completes.
// appears in failure tab.
  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(
() => byId(dom, "failure-summary").textContent.trim() === "Task failed, but this is a frontend mock scenario.",
"Failure diagnostics second-pass render completion",
  );
  assert.equal(byId(dom, "failure-category").textContent.trim(), "mock_render_failure");
  assert.equal(byId(dom, "failure-stage").textContent.trim(), "render");
assert.equal(byId(dom, "failure-root-cause").textContent.trim(), "Simulated failure for UI debugging.");
assert.equal(byId(dom, "failure-suggestion").textContent.trim(), "Switch to ?mock=succeeded to view success state.");
assert.equal(byId(dom, "failure-retryable").textContent.trim(), "Yes");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：StageHistoryList/EventsList Structured JSX render item by item", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);

await waitFor(() => byId(dom, "overview-stage-list").querySelectorAll(".stage-history-item").length > 0, "Stage timeline rendered items");
  const stageItems = byId(dom, "overview-stage-list").querySelectorAll(".stage-history-item");
  assert.equal(byId(dom, "overview-stage-empty").classList.contains("hidden"), true);
// Assert structure item by item (index/title/duration child nodes exist), replacing legacy markup string assertions.
  stageItems.forEach((item, index) => {
    assert.equal(item.querySelector(".stage-history-index").textContent.trim(), `${index + 1}`);
    assert.ok(item.querySelector(".stage-history-title").textContent.trim().length > 0);
    assert.ok(item.querySelector(".stage-history-duration"));
  });

  click(dom, byId(dom, "detail-tab-events"));
// fetchJobEvents uses real polling fetch, not static getMockJobEvents() snapshot
// (Event streams from both are not guaranteed to be byte-identical); read actual fetched data from store
// Use eventsPayload as expected value to assert DOM consistency with its own data source.
await waitFor(() => services.statusDetail.store.getSnapshot().overview.eventsPayload?.items?.length > 0, "Event stream data arrived in store");
  const expectedEventCount = services.statusDetail.store.getSnapshot().overview.eventsPayload.items.length;
await waitFor(() => byId(dom, "events-list").querySelectorAll(".event-item").length === expectedEventCount, "Event stream rendered item by item");
assert.equal(byId(dom, "events-status").textContent.trim(), `Last ${expectedEventCount} items`);
  const eventItems = byId(dom, "events-list").querySelectorAll(".event-item");
  eventItems.forEach((item) => {
    assert.ok(item.querySelector(".event-badge"));
    assert.ok(item.querySelector(".event-title"));
  });

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog: Failure tab replay (rerunSuccess. â Close dialog + startPolling Joint debugging", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);

  click(dom, byId(dom, "detail-tab-failure"));
await waitFor(() => byId(dom, "failure-rerun-btn").disabled === false, "resumePlan.can_resume=true enables button");
assert.match(byId(dom, "failure-rerun-status").textContent, /can recover from render/);

  click(dom, byId(dom, "failure-rerun-btn"));
await waitFor(() => byId(dom, "status-detail-dialog") === null, "Dialog closes after rerun success");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== originalJobId,
"startPolling switches to new job after rerun success",
  );
  assert.match(services.features.jobRuntimeFeature.currentJobId(), /^mock-rerun-/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog: Translation debug tab ââ Summary/Filter/Selection/Pagination/Replay closed loop", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockTranslationItems, getMockTranslationSummary } = await import("../src/js/mock/translation.js");
  const jobId = await openStatusDetailDialog(dom, services);
  const summary = getMockTranslationSummary(jobId).summary;
  const allItems = getMockTranslationItems(jobId, {}).items;

  click(dom, byId(dom, "detail-tab-translation"));
await waitFor(() => services.statusDetail.store.getSnapshot().translation.summary, "Translation summary data arrived in store");
await waitFor(() => byId(dom, "translation-debug-content").classList.contains("hidden") === false, "Translation debug content rendered");
  await wait(0);

  assert.equal(byId(dom, "translation-count-translated").textContent.trim(), `${summary.status_summary.translated}`);
  assert.equal(byId(dom, "translation-count-kept-origin").textContent.trim(), `${summary.status_summary.kept_origin}`);
  assert.equal(byId(dom, "translation-provider-family").textContent.trim(), summary.provider_family);

await waitFor(() => byId(dom, "translation-items-list").querySelectorAll(".translation-item-card").length === allItems.length, "Item list rendering complete");
// Auto-select first item by default.
await waitFor(() => byId(dom, "translation-item-detail").classList.contains("hidden") === false, "First item details auto-loaded");
  assert.match(byId(dom, "translation-item-meta").textContent, new RegExp(allItems[0].item_id));

// Pagination contract: mock data volume < limit(20), prev/next should both be disabled.
  assert.equal(byId(dom, "translation-items-prev").disabled, true);
  assert.equal(byId(dom, "translation-items-next").disabled, true);

// Filter: switch to kept_origin, list narrows to category count.
  const keptOriginItems = allItems.filter((item) => item.final_status === "kept_origin");
  selectOption(dom, byId(dom, "translation-filter-final-status"), "kept_origin");
  click(dom, byId(dom, "translation-filter-apply"));
  await waitFor(
    () => byId(dom, "translation-items-list").querySelectorAll(".translation-item-card").length === keptOriginItems.length,
"List narrows after filtering kept_origin",
  );

// Select an item from the list, assert detail panel switch.
  const secondCard = byId(dom, "translation-items-list").querySelectorAll(".translation-item-card")[
    keptOriginItems.length > 1 ? 1 : 0
  ];
  const targetItemId = secondCard.dataset.translationItemId;
  click(dom, secondCard);
await waitFor(() => byId(dom, "translation-item-meta").textContent.includes(targetItemId), "Detail updates after selecting another item");

// Replay current item.
  click(dom, byId(dom, "translation-item-replay"));
await waitFor(() => byId(dom, "translation-replay-result").classList.contains("hidden") === false, "Replay result rendered");
assert.match(byId(dom, "translation-replay-status").textContent, /Replay complete|Replay returned error/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog: Data source is independentââstatus-detail overview does not read statusCardStore", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);
  await wait(30);

  const detailSnapshot = services.statusDetail.store.getSnapshot();
  const cardSnapshot = services.statusCard.store.getSnapshot();
// Two stores are different instances (Blueprint Â§1.0 Data Source Iron Law), each holding its own job field.
  assert.notEqual(services.statusDetail.store, services.statusCard.store);
assert.ok(detailSnapshot.overview.job, "status-detail holds its own job raw data");
assert.ok(cardSnapshot.snapshot.job, "statusCardStore also holds job (parallel read paths, independent)");

  root.unmount();
  services.dispose();
  host.remove();
});
