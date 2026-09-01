import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// StatusCard (Phase 3b job-runtime domain) component-level tests. Covers blueprint Â§6 new tests â¤â¥:
// â¤ StatusCard contract (stage flow/substage/retry/result actions/data-status/
//    ring ids); â¥ Stage selection semantics (clicking early stages not reset by subsequent unrelated renders).
// Use real mountJobRuntimeFeature polling chain (?mock=translate), do not mock fetchâ
// Directly verify statusCardPresenter writes to store within startPolling synchronous chain (blueprint risk 6:
// first frame placeholder, otherwise empty card flashes on open) and whether renderPatch three-source convergence actually
// works end-to-end.

function makeDom(search) {
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
// Radix Presence/Tabs (introduced in Phase B) requires cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended)âimplemented on jsdom window, but not
// copied to bare global like requestAnimationFrame; adding them here. NodeFilter
// is a new requirement for Phase C (TranslationWorkflowDialog replaced by Radix Dialog)â
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
assert.fail(`Timeout waiting: ${description}`);
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
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
// forceMount ContentâStatusCard/#job-status-card is embedded in this dialog, only
// mounts after dialog opens (following Phase C first-batch dialog precedents like CredentialsDialog:
// Not mounted when closed). Call workflowDialog.openUpload() directly (instead of simulating click on "Add"
// button) to mount it, avoiding impact on polling/rendering assertions after startPollingâin real user flows,
// "Open dialog â Submit/Resume task" naturally starts with opening the dialog.
  services.workflowDialog.openUpload();
await waitFor(() => byId(dom, "job-status-card"), "job-status-card mounted after workflow dialog opens");
  await wait(0);

  return { services, root, host };
}

test("StatusCard: DOM contract IDs exist one by one (hidden area + ring + stage flow)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);

  const contractIds = [
    "job-status-card", "cancel-btn", "status-detail-btn", "status-stage-flow",
    "status-ring-label", "status-ring-value", "status-ring-elapsed",
    "status-stage-detail", "status-stage-error-summary", "status-progress-bar",
    "job-progress-bar", "job-progress-text", "status-progress-percent",
    "status-progress-ring", "status-progress-ring-meta", "status-stage-retry",
    "job-id", "job-status", "job-stage-detail", "query-job-duration", "job-finished-at",
  ];
  for (const id of contractIds) {
assert.ok(byId(dom, id), `Contract ID missing: #${id}`);
  }
  assert.equal(byId(dom, "job-status-card").querySelectorAll(".status-stage-step[data-stage-key]").length, 4);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard: Real polling (mock=translate) drives ring/progress/stage flow (no empty card flash on first frame)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());

// startPolling synchronous chain already called renderJob(placeholder), should
// see non-empty placeholder value (Blueprint Risk 6).
  assert.notEqual(byId(dom, "status-ring-label").textContent.trim(), "");

await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "Preparing", "Ring value updates after real task data arrives");
  await waitFor(() => {
    const activeStep = byId(dom, "status-stage-flow").querySelector('.status-stage-step[data-stage-key="translate"]');
    return activeStep?.classList.contains("is-active");
}, "translate stage highlighted on flow bar");

  const progressBlock = byId(dom, "job-status-card").querySelector(".status-progress-block");
assert.equal(progressBlock.classList.contains("hidden"), false, "Translate stage progress block should be visible");

await waitFor(() => byId(dom, "job-status").textContent.trim() !== "idle", "Hidden area job-status summary updated (parallel smoke dependency)");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard: Stage selection semantics + Retry + Cancel", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => {
    const activeStep = byId(dom, "status-stage-flow").querySelector('.status-stage-step[data-stage-key="translate"]');
    return activeStep?.classList.contains("is-active");
}, "Translation stage ready");

// ---- Stage Selection: Click ocr (index < translate, optional) â Selection state switch ----
  const ocrStep = byId(dom, "status-stage-flow").querySelector('.status-stage-step[data-stage-key="ocr"]');
assert.equal(ocrStep.disabled, false, "OCR stage reached, should be selectable");
  click(dom, ocrStep);
await waitFor(() => ocrStep.getAttribute("aria-selected") === "true", "Selection state switches after clicking OCR");
  assert.equal(byId(dom, "status-ring-label").textContent.trim(), "OCR");

// ---- Stage Selection Semantics: Irrelevant renders under same job/currentStageKey should not clear manual selection ----
  services.statusCard.store.actions.setCancelDisabled(false);
  await wait(30);
assert.equal(ocrStep.getAttribute("aria-selected"), "true", "Irrelevant store notifications should not reset manual selection");

// ---- Cancel: Button should be grayed out immediately after click (shellViewPort.setCancelDisabled takes effect synchronously) ----
  const cancelButton = byId(dom, "cancel-btn");
  if (!cancelButton.disabled) {
    click(dom, cancelButton);
await waitFor(() => cancelButton.disabled === true, "Cancel button disabled immediately after click");
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard: Retry button (clickable and triggers new polling after mock stage-actions data arrives)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => {
    const retryContainer = byId(dom, "status-stage-retry");
    return retryContainer && !retryContainer.classList.contains("is-empty");
}, "Translate stage retry button ready (mock fetchJobStageActions always returns translation as retryable)");

  const retryButton = byId(dom, "status-stage-retry").querySelector(".status-stage-retry-btn");
assert.ok(retryButton, "Retry button should exist");
  assert.equal(retryButton.disabled, false);
  assert.equal(retryButton.dataset.retryStage, "translation");

  let retryEventSeen = false;
  dom.window.document.addEventListener(APP_EVENTS.retryStage, (event) => {
    retryEventSeen = event.detail?.stage === "translation";
  });

  const previousJobId = services.features.jobRuntimeFeature.currentJobId();
  click(dom, retryButton);
await waitFor(() => retryEventSeen, "Clicking retry button dispatches retryStage event (Blueprint Â§5 Event Contract)");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== previousJobId,
    "job-runtime 引擎消费 retryStage 后切换到新 job(mock retryJobStage 返回新 job_id)",
  );

  root.unmount();
  services.dispose();
  host.remove();
});
