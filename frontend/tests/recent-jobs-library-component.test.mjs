import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// RecentJobsLibrary / RecentJobCard (Phase 3b recent-jobs domain) component-level tests.
// Covers blueprint §6 new tests ①②③:
// ① Render library grid. + smoke DOM contract (mock=parallel, uses real mountRecentJobsFeature
//    Initial load chain, do not mock fetch — validate directly. isMockMode() end-to-end on short-circuit path.
//    Assembly?work);
// ② Card interaction (delete confirm/cancel/confirm deletion, reader);
// ③ Card rendering isolation (replaceItem single card, assert remaining card render counts unchanged. — memo regression anchor,
//    Black box. DOM comparison indistinguishable "skip render" vs "render output identical." Must use
//    RecentJobCard.jsx Exported render counter)。

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (Phase B) require cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation has ended) — jsdom's window has implementation, but not
// copied to bare global like requestAnimationFrame, we supplement here. NodeFilter
// is newly needed in Phase C (TranslationWorkflowDialog switched to Radix Dialog) —
// Dialog.Content's FocusScope uses it for focusable element tree traversal.
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
assert.fail(Timeout waiting for: {description}`);
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function makeItem(index, overrides = {}) {
  return {
    job_id: `job-${index}`,
    title: `Book ${index}`,
    display_name: `Book ${index}`,
    status: "succeeded",
    display_stage: "done",
    substage: "",
    page_count: 10 + index,
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
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
await waitFor(() => dom.window.document.getElementById("library-view"), "HomeApp first frame rendered");
  await wait(0);

  return { services, root, host };
}

function byId(dom, id) {
  return dom.window.document.getElementById(id);
}

test("RecentJobsLibraryInitializing(mock=parallel) Render Grid + DOM contract", async () => {
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

// mock=parallel goes through isMockMode() short-circuit (fetchLibraryBookList/fetchJobList won't
// hit real network), verify that mountRecentJobsFeature is assembled in initialize() synchronous chain
// Active — this is exactly the "5 Default param chain break" risk (blueprint risk 9) end-to-end counterexample: if
  // composition.js incoming React viewPort Defaulted createRecentJobsViewPort()
// composition.js incoming React viewPort defaulted createRecentJobsViewPort()
// silently short-circuit, below DOM contract assertions will all fail (legacy system manipulates real data DOM, new world
  const contractIds = [
    "library-view", "recent-jobs-scroll-body", "recent-jobs-summary",
    "recent-jobs-empty", "library-grid", "recent-jobs-list", "load-more-jobs-btn",
  ];
  for (const id of contractIds) {
assert.ok(byId(dom, id), `Contract id missing: #{id});
  }

  await waitFor(() => byId(dom, "recent-jobs-list").querySelector(".recent-job-item[data-job-id]"), "Grid has at least one card.");
  assert.equal(byId(dom, "recent-jobs-list").classList.contains("hidden"), false);
  const card = byId(dom, "recent-jobs-list").querySelector(".recent-job-item[data-job-id]");
  assert.ok(card.dataset.jobId, "Card required. data-job-id");
  assert.match(byId(dom, "recent-jobs-summary").textContent, /Stage Spec|Unknown/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibraryCard Interaction(select / reader / delete Confirm & Cancel / Confirm Delete)", async () => {
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  const items = [makeItem(1), makeItem(2), makeItem(3)];
  services.library.recentJobsStore.actions.setItems(items);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 3, "Three cards in position.");

  const cardOf = (jobId) => byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${jobId}"]`);

// ---- select no document_id, still open book details (do not pop up old workflow window) + silent polling ----
  let openCount = 0;
  dom.window.document.addEventListener(
    (await import("../src/js/contracts/app-contract.js")).APP_EVENTS.openTranslationWorkflow,
    () => { openCount += 1; },
  );
  click(dom, cardOf("job-1"));
  await waitFor(() => byId(dom, "book-detail-dialog"), "Click card to open book details");
  assert.equal(openCount, 0, "Clicking card does not open #translation-workflow-dialog");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() === "job-1",
"select/detail path silent polling",
  );

// ---- reader: click floating "Side-by-side reading" button → openReaderRequested ----
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => {
    readerDetail = event.detail;
  });
  const readerButton = cardOf("job-2").querySelector(".recent-job-reader");
  click(dom, readerButton);
  await waitFor(() => readerDetail?.jobId === "job-2", "reader Button trigger openReaderRequested");

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibraryCard Eyes=Quick read (completed → side-by-side reading; fail passive → don't trigger)", async () => {
// Card copy verbatim. After PDF_MD_lib's BookCard, delete/move translations to book details modal., card
// Keep one eye. = quick read: dispatch comparison review complete; no readable target (failed and no document_id)
  // Click dispatches nothing(Stop drilling into reader internals to error.)。
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  const items = [
    makeItem(1, { status: "failed" }),
    makeItem(2, { status: "succeeded" }),
  ];
  services.library.recentJobsStore.actions.setItems(items);
await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 2, "Two cards in place");

  const cardOf = (jobId) => byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${jobId}"]`);
  // Cards no longer deletable./Translate button(User already in detail modal.)
  assert.equal(cardOf("job-2").querySelector(".recent-job-delete"), null, "Cards no longer have delete buttons.");
  assert.equal(cardOf("job-2").querySelector(".recent-job-translate"), null, "Translate button removed from cards.");

  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => { readerDetail = event.detail; });

// failed task (makeItem no document_id, not succeeded) → eye click lacks readable target, do not dispatch
  click(dom, cardOf("job-1").querySelector(".recent-job-reader"));
  await wait(30);
  assert.equal(readerDetail, null, "Failed, no source.:Clicking eye does not trigger. openReaderRequested");

// completed → side-by-side reading
  click(dom, cardOf("job-2").querySelector(".recent-job-reader"));
  await waitFor(() => readerDetail?.jobId === "job-2", "Completed point-eye dispatch comparative reading.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibraryCollection Document Card (untranslated) — Logo/tap card for details, eye reads original", async () => {
// Collection document (synthetic job_id doc:) enters grid: badge "Collection", click card to open book details modal.
// eye = read original (dispatch openReaderRequested with documentId, without jobId).
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);

  const libraryOnlyItem = {
    job_id: "doc:doc-ref-6a1f2c", document_id: "doc-ref-6a1f2c", library_only: true,
title: "Reference book only in library", display_name: "Reference book only in library", status: "", page_count: 42,
    updated_at: "2026-07-01T00:00:00Z",
  };
  services.library.recentJobsStore.actions.setItems([libraryOnlyItem, makeItem(2, { status: "succeeded" })]);
await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 2, "Two cards in place");

  const card = byId(dom, "recent-jobs-list").querySelector('.recent-job-item[data-library-only="true"]');
  assert.ok(card, "Collection cards rendered.");
  assert.equal(card.getAttribute("data-document-id"), "doc-ref-6a1f2c");
assert.match(card.textContent, /Collection/, "Show collection badge");
  assert.equal(card.querySelector(".recent-job-delete"), null, "Card cannot be deleted(In the detail popup)");

  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => { readerDetail = event.detail; });

// Click card body → open book details modal (does not dispatch openReaderRequested)
  click(dom, card);
  await waitFor(() => byId(dom, "book-detail-dialog"), "Click library card to open book details dialog");
  assert.equal(readerDetail, null, "Clicking card body does not trigger openReaderRequested");
  services.bookDetail.dialogStore.close();

// eye = read original (with documentId, excluded jobId)
  click(dom, card.querySelector(".recent-job-reader"));
await waitFor(() => readerDetail?.documentId === "doc-ref-6a1f2c", "Eye dispatches openReaderRequested with documentId");
  assert.ok(!readerDetail.jobId, "Collection documents not included. jobId");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Book Details Popup:Holding Location → immediately get progress + Silent Grid Update(No flash loading)", async () => {
// Click collection card to open details → translate whole book → mock attaches active_job_id →
// detail payload/progress card immediately has job_id, grid has real job row, no full-page loading reload.
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);
  const { HOME_LOADING_STATES } = await import("../src/js/features/home/state.js");

  const { getMockDocumentList } = await import("../src/js/mock/documents.js");
  const untranslated = getMockDocumentList().documents.find((doc) => !`${doc.active_job_id || ""}`.trim());
  assert.ok(untranslated, "mock Contains archival documents");

  services.library.recentJobsStore.actions.setItems([{
    job_id: `doc:${untranslated.document_id}`, document_id: untranslated.document_id,
    library_only: true, title: untranslated.title, status: "", page_count: untranslated.page_count,
  }]);
await waitFor(() => byId(dom, "recent-jobs-list").querySelector('.recent-job-item[data-library-only="true"]'), "collection card in place");

  click(dom, byId(dom, "recent-jobs-list").querySelector('.recent-job-item[data-library-only="true"]'));
  await waitFor(() => byId(dom, "book-detail-dialog"), "Detail popup opened");
  click(dom, byId(dom, "book-detail-tab-translate"));
  await waitFor(() => byId(dom, "book-detail-translate-btn"), "Details popup translation button ready.");
  click(dom, byId(dom, "book-detail-translate-btn"));

  await waitFor(
    () => getMockDocumentList().documents
      .find((doc) => doc.document_id === untranslated.document_id)?.active_job_id,
    "translateDocument Attach to document active_job_id",
  );

// detail payload immediately attaches real job (translation Tab can embed StatusCard)
  await waitFor(() => {
    const payload = services.bookDetail.dialogStore.getState().payload;
    const jobId = `${payload?.job_id || ""}`.trim();
    return jobId && !jobId.startsWith("doc:") && payload?.library_only === false;
}, "detail payload now has real job_id");

// progress card should appear inside detail bd-job-status-inner (no need to wait for full page reload)
await waitFor(() => byId(dom, "book-detail-job-status-card"), "Translation Tab UI updates immediately. Optimize rendering pipeline. StatusCard");
  const statusCard = byId(dom, "book-detail-job-status-card");
  assert.ok(
    statusCard.querySelector(".bd-job-status-inner"),
    "progress falls on bd-job-status-inner(embedded in detail, not workflow dialog)",
  );
  assert.ok(
    statusCard.querySelector(".bd-job-status-bar"),
    "Inline area uses progress bar (no ring)",
  );
  assert.ok(
    statusCard.querySelector(".status-stage-flow"),
    "Stage flow in detail embedded card",
  );

// must not open workflow dialog as progress UI
  assert.equal(
    byId(dom, "translation-workflow-dialog"),
    null,
    "Clicking Details does not open workflow popup",
  );
  assert.equal(
    services.stores.statusArea.getSnapshot().visible,
    false,
    "Main status area remains hidden (progress not in popup StatusCard）",
  );

// grid has real job row
  await waitFor(
    () => services.library.recentJobsStore.getSnapshot().items
      .some((item) => item.document_id === untranslated.document_id && !item.library_only),
"Grid shows real job row",
  );

  assert.notEqual(
    services.stores.homeState.getSnapshot().recentJobsLoadingState,
    HOME_LOADING_STATES.LOADING,
    "After translation, silently update, do not. recentJobs Press loading",
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibraryCard rendering isolation(replaceItem Single Card,Others 23 Card render count unchanged.)", async () => {
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);
  const {
    getCardRenderCountForTests,
    resetCardRenderCountsForTests,
  } = await import("../src/pages/home/features/library/index.js");

  const items = Array.from({ length: 24 }, (_, index) => makeItem(index));
  services.library.recentJobsStore.actions.setItems(items);
  await waitFor(() => byId(dom, "recent-jobs-list").querySelectorAll(".recent-job-item").length === 24, "24 Card in place.");
await wait(30); // let first round render effects/commits settle completely

  resetCardRenderCountsForTests();

  const patchedJobId = "job-5";
  const previous = items.find((item) => item.job_id === patchedJobId);
  services.library.recentJobsStore.actions.replaceItem({
    ...previous,
    title: "Book 5 · Title updated",
    status: "running",
    display_stage: "translate",
  });

  await waitFor(() => {
    const card = byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${patchedJobId}"]`);
return card?.querySelector(".recent-job-id")?.title === "Book 5 · Updated title";
  }, "Patched card content updated.");
  await wait(30);

// Assert "at least one re-render" rather than "exactly once": react-dom's useSyncExternalStore in
// dev builds, if a store notifies during rendering (non-React event batching context, e.g.
// this test directly calls store.actions rather than via onClick), another notification may occur during commit
// do a "tear prevention" consistency check before commit, replaying a render on the same fiber (the two results
// props/output are identical, not two real updates from stale→latest) — this is React internal behavior
// (can be verified by stack trace that both calls originate from beginWork/updateFunctionComponent),
// not a memo logic flaw here; asserting strict "===1" would be overly sensitive to React version upgrades.
// The core invariant is always the following "uninvolved cards 0 times".
  assert.ok(getCardRenderCountForTests(patchedJobId) >= 1, "Patched cards should re-render at least once.");
  for (const item of items) {
    if (item.job_id === patchedJobId) {
      continue;
    }
    assert.equal(
      getCardRenderCountForTests(item.job_id),
      0,
Uninvolved card {item.job_id} should not re-render (memo regression)`,
    );
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("RecentJobsLibrary：workflow Suspend without deadlock(open→job-updated Still patching,No full-page reload→related→300ms Restore after refresh)", async () => {
// Blueprint risk 5: workflow open during refresh-scheduler.setSuspended(true),
// command-handlers.js's onJobUpdated still unconditionally calls runtimePatches.update (single card
// patch unaffected), but scheduleRefresh (full page refresh) will be suspended and swallowed; after close
// scheduleRefresh({delay:300}) should resume refresh, not deadlock permanently.
  const dom = makeDom("?mock=parallel");
  const { services, root, host } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
  const { HOME_LOADING_STATES } = await import("../src/js/features/home/state.js");

// After F2 document centralization, grid loads "documents" (mock has several, including collection), here we only need one
// translated card with real job as patch target (runtimePatches.update finds card by real job_id).
  await waitFor(
    () => services.library.recentJobsStore.getSnapshot().items.some((item) => item.job_id && !item.library_only),
    "Translated on first load mock Documentation ready.",
  );
  const originalItem = services.library.recentJobsStore
    .getSnapshot().items.find((item) => item.job_id && !item.library_only);

  services.workflowDialog.requestOpenUpload();
// Phase C (shadcn refactor): after TranslationWorkflowDialog switched to Radix Dialog, does not
// forceMount Content — not mounted when closed, assertion changed from "hidden class" to "whether mounted"
// (same as CredentialsDialog and other Phase C first-wave dialogs).
await waitFor(() => byId(dom, "translation-workflow-dialog") !== null, "workflow dialog opened (Suspend Refresh)");

  let sawLoadingWhileSuspended = false;
  const unsubscribe = services.stores.homeState.subscribe((snapshot) => {
    if (snapshot.recentJobsLoadingState === HOME_LOADING_STATES.LOADING) {
      sawLoadingWhileSuspended = true;
    }
  });

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.libraryJobUpdated, {
    detail: { job: { ...originalItem, title: "Patched While Suspended" } },
  }));

  await waitFor(() => {
    const card = byId(dom, "recent-jobs-list").querySelector(`.recent-job-item[data-job-id="${originalItem.job_id}"]`);
    return card?.querySelector(".recent-job-id")?.title === "Patched While Suspended";
  }, "Single-card patch during suspend.(runtimePatches.update)Remains unconditionally effective.");

  await wait(150);
  assert.equal(sawLoadingWhileSuspended, false, "Do not trigger full-page refresh during suspend.(scheduleRefresh Should be isSuspended Swallow)");
  unsubscribe();

// recovery refresh after close is scheduleRefresh({delay:300}) → loadRecentJobs({reset:true,
// silent:true}) — silent:true means loadingState won't flip to LOADING (silent refresh
// should not make grid flash loading), so we change to directly observe recentJobsStatePort.store
// whether a setItems notification actually happened again (the only visible signal that silent refresh completed).
  let notifyCountAfterClose = 0;
  const unsubscribe2 = services.library.recentJobsStore.subscribe(() => {
    notifyCountAfterClose += 1;
  });
  services.workflowDialog.requestClose();
  await waitFor(() => byId(dom, "translation-workflow-dialog") === null, "Workflow dialog closed.");
  await waitFor(() => notifyCountAfterClose > 0, "After closing 300ms Silent refresh should resume.(No deadlocks.)");
  unsubscribe2();

  root.unmount();
  services.dispose();
  host.remove();
});
