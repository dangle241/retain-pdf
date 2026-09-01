import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// artifact-downloads (dialogs Blueprint Â§7) Component-level test. This domain was previously skipped by successive rounds agent Skip unnecessary code. Simplifyâ
// ResultActions.jsx/StatusDetailDialog.jsx 7 Download ids Rendered bare
// <a href target="_blank">,composition.js Never mount Pass
// mountArtifactDownloadsFeature,Causes click to trigger pure browser navigation (without X-API-Key，
// Backend likely 401) instead of fetchProtected Download. This file overrides two new acceptance tests:
// â  Click hit 7 ids Trigger correct download individually. (mock fetchProtected, Not bare navigation.);
// â¡ busy Dynamic text not overwritten by parent component re-render. (Blueprint Â§7.5 Option 2 core mechanism).
//
// makeDom/waitFor/bootHomeApp Mode mirror status-card-component.test.mjs Precedent.

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
// copied to bare global like requestAnimationFrame; adding it here. NodeFilter
// is Phase C (TranslationWorkflowDialog/StatusDetailDialog replaced with Radix Dialog)
// new requirementâDialog.Content's FocusScope uses it for focusable element tree traversal.
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
// After migrating StatusDetailDialog to Radix Tabs, dispatching only "click" Won't trigger tab
// switching. Real browser clicks are a full mousedownâmouseupâclick sequence, Here.
// mousedown makes simulated clicks closer to real interaction, rather than relaxing any assertions.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
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
await waitFor(() => byId(dom, "library-add-pdf-btn"), "HomeApp first frame rendering");
// Phase C (shadcn refactor): After replacing TranslationWorkflowDialog with Radix Dialog, do not
  // forceMount Content——job-status-card/ResultActions The download button is embedded in this
// forceMount Contentâjob-status-card/ResultActions The download button is embedded in this
// Dialog interior, Mount only if dialog opened. (Same as CredentialsDialog and other Phase C first batch
  services.workflowDialog.openUpload();
await waitFor(() => byId(dom, "job-status-card"), "job-status-card mounted after workflow dialog opens");
  await wait(0);

  return { services, root, host };
}

// jsdom Not implemented URL.createObjectURL/revokeObjectURL(downloads.js#downloadBlob
// Used to Blob Let browser save)âUse a callable with call logging. stub Replace, mirror
// glossaries-dialog-component.test.mjs "CSV Export" Test precedent.
function stubObjectUrl() {
  const previousURL = globalThis.URL;
  const calls = [];
  globalThis.URL = class extends previousURL {
    static createObjectURL(blob) {
      calls.push(blob);
      return `blob:mock-${calls.length}`;
    }

    static revokeObjectURL() {}
  };
  return {
    calls,
    restore() {
      globalThis.URL = previousURL;
    },
  };
}

test("artifact-downloadsReal Polling (mock=done) drives ResultActions Three download buttons ready and clickable.", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "Preparing", "real task data arrives");

  const markdownBtn = byId(dom, "status-markdown-bundle-btn");
  const sourcePdfBtn = byId(dom, "source-pdf-btn");
  const pdfBtn = byId(dom, "pdf-btn");

  for (const [label, el] of [["status-markdown-bundle-btn", markdownBtn], ["source-pdf-btn", sourcePdfBtn], ["pdf-btn", pdfBtn]]) {
    assert.ok(el, `${label} Required`);
    assert.equal(el.getAttribute("aria-disabled"), "false", `${label} Clickable`);
assert.match(el.dataset.url || "", /^mock:\/\//, `${label} data-url should point to protected backend resource.(Check for null. Use `if (value !== null)` â skipped: optional chaining, add when nullable objects involved./'#')`);
assert.equal(el.classList.contains("disabled"), false, `${label} must not contain disabled class`);
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloadsClick ResultActions 3 ProtectedDownloadButton.onclick = () => downloadProtectedFile(url, token); fetchProtected download process start. Select file. Confirm save location. Wait progress complete.(Not bare navigation.)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "Preparing", "real task data arrives");
    await waitFor(() => byId(dom, "pdf-btn").getAttribute("aria-disabled") === "false", "Download ready");

    const startHref = dom.window.location.href;
    const cases = [
// status-markdown-bundle-btn no preferSuggestedName, from filename
// fileNameFromDisposition fallback `${jobId}-markdown.zip`(mock no response
// content-disposition header).
      ["status-markdown-bundle-btn", /-markdown\.zip$/],
      // source-pdf-btn/pdf-btn all preferSuggestedName,Filename derived from
// resolveSourcePdfDownloadName/resolveTranslatedPdfDownloadName based on
// .pdf use suffix assertion. Cannot depend on mock job. Original filename lost after upload/processing unless explicitly preserved in metadata or headers.
      ["source-pdf-btn", /\.pdf$/],
      ["pdf-btn", /\.pdf$/],
    ];

    for (const [id, expectedNamePattern] of cases) {
      const before = urlStub.calls.length;
      const link = byId(dom, id);
      assert.equal(link.getAttribute("aria-disabled"), "false", `${id} should be available before clicking`);
      click(dom, link);
// Sync on click. preventDefault, no actual page navigation.(document-level delegated click
// in handleProtectedArtifactClick called at the top event.preventDefault()).
      assert.equal(dom.window.location.href, startHref, `${id} Click must not trigger page navigation.`);
      await waitFor(() => urlStub.calls.length > before, `${id} Click Apply fetchProtected→saveResponseDownload Trigger once downloadBlob`);
      const blob = urlStub.calls[urlStub.calls.length - 1];
      assert.ok(blob.size > 0, `${id} Downloaded Blob Actual bytes expected(Prove it really left. mock fetch,not empty placeholder)`);
      // download-toast(DownloadToastHost.jsx)Reflect correct filename——prove that it follows
// Use downloads.js real response processing pipeline, not ad-hoc fake data.
      await waitFor(
        () => expectedNamePattern.test(byId(dom, "download-toast-title")?.textContent || ""),
        `${id} After download toast Title must include expected filename.`,
      );
// After download completes, busy state should be cleared and button re-enabled (controller.js finally block).
      await waitFor(() => byId(dom, id).getAttribute("aria-disabled") === "false", `${id} Re-enable after download completes.`);
    }
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：StatusDetailDialog Overview Panel markdown-bundle-btn Also access download flow.", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-detail-btn"), "Status card detail button ready");
    click(dom, byId(dom, "status-detail-btn"));
// Phase C (shadcn refactor): StatusDetailDialog no longer uses forceMount after switching to Radix Dialog
// Content: Change assertion from "open attribute truthiness" to "whether mounted".
await waitFor(() => byId(dom, "status-detail-dialog") !== null, "Detail dialog opened");

await waitFor(() => byId(dom, "markdown-bundle-btn")?.getAttribute("aria-disabled") === "false", "Overview download ready (read statusCardStore)");
    const link = byId(dom, "markdown-bundle-btn");
    assert.match(link.dataset.url || "", /^mock:\/\/bundle\.zip/);

    const before = urlStub.calls.length;
    click(dom, link);
    await waitFor(() => urlStub.calls.length > before, "Overview panel download button click triggers. downloadBlob");
    await waitFor(() => byId(dom, "markdown-bundle-btn").getAttribute("aria-disabled") === "false", "Re-enable after download completes.");
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: document Level delegation overrides all. 7 Contract id (Currently contains none. 3 UI Consumption Points)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");
  const { DOWNLOAD_ACTION_IDS } = await import("../src/js/contracts/download-action-contract.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "Preparing", "Real task data arrived");

    // download-btn/markdown-btn/markdown-raw-btn Currently none React Component rendering
// (recent-jobs Contractor deems outside dead code list.), but controller.js's
    // document Level delegation click is pure id Selector match,Button renderer irrelevant——Use synthetic nodes
// Invalid input. Need full text to translate. 3 ids also correctly taken over, proving 7 Contract ids all active, not just connected.
        // 4 Already rendered.
    const syntheticIds = [
      DOWNLOAD_ACTION_IDS.BUNDLE,
      DOWNLOAD_ACTION_IDS.MARKDOWN_JSON,
      DOWNLOAD_ACTION_IDS.MARKDOWN_RAW,
    ];
    const urlByAction = {
      [DOWNLOAD_ACTION_IDS.BUNDLE]: "mock://bundle.zip",
      [DOWNLOAD_ACTION_IDS.MARKDOWN_JSON]: "mock://markdown.json",
      [DOWNLOAD_ACTION_IDS.MARKDOWN_RAW]: "mock://markdown.raw",
    };
    for (const id of syntheticIds) {
      const link = dom.window.document.createElement("a");
      link.id = id;
      link.href = urlByAction[id];
      link.dataset.url = urlByAction[id];
      dom.window.document.body.appendChild(link);

      const before = urlStub.calls.length;
      click(dom, link);
      await waitFor(() => urlStub.calls.length > before, `Composite node #${id} Click must hit same target. document Level delegation handler`);
      link.remove();
    }
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads: busy state text unaffected by parent (StatusCard) re-render overwrites (Blueprint Â§7.5 Plan 2 Core Guarantees)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "Preparing", "Real task data arrived");
await waitFor(() => byId(dom, "pdf-btn").getAttribute("aria-disabled") === "false", "Download button ready");

  const { DOWNLOAD_ACTION_IDS } = await import("../src/js/contracts/download-action-contract.js");
  const actionId = DOWNLOAD_ACTION_IDS.PDF; // "pdf-btn"

// Simulate controller.js Invoke mid-download. viewPort.setLinkBusy(link, true, "37%")
// Do not modify DOM directly, only write to busy store.
  services.artifactDownloads.busyStore.setBusy(actionId, true, "37%");
  await waitFor(() => byId(dom, actionId).querySelector("span").textContent === "37%", "busy Status text applies immediately.");
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "true", "Disabled while downloading");

// Create parent component unrelated to download (StatusCard) re-renderâmirror
// status-card-component.test.mjs "Unrelated store notifications should not reset manual selection" Precedent
  // here what is verified is the download busy Copy must not revert to original on same-style re-render. label(Old World Direct Edit DOM
  // Virtualized here. DOM diff Swallow. Option 2 holds.)。
  for (let i = 0; i < 5; i += 1) {
    services.statusCard.store.actions.setCancelDisabled(i % 2 === 0);
  }
  await wait(30);
  assert.equal(
    byId(dom, actionId).querySelector("span").textContent,
    "37%",
"parent component (StatusCard) re-renders due to unrelated store changes, the download text should remain unchanged (not revert to "Download PDF")(StatusCard) Irrelevant store Download label unchanged on re-render (Not reverted to 'Download PDF')",
  );
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "true");

// Download complete (controller.js finally block setLinkBusy(link, false))âCopy should
  // Restore original label Re-clickable.
  services.artifactDownloads.busyStore.setBusy(actionId, false);
await waitFor(() => byId(dom, actionId).querySelector("span").textContent === "Download PDF", "busy After completion, the text restores");
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "false");

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：StatusDetailDialog Download Overview busy State also not paginated/tab Toggle equal-weight render overlay.", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("../src/js/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
await waitFor(() => byId(dom, "status-detail-btn"), "Status card detail button ready");
  click(dom, byId(dom, "status-detail-btn"));
// Phase C (shadcn refactor): StatusDetailDialog no longer forceMounts after switching to Radix Dialog
// Content: assertion changed from "open attribute truthiness" to "whether mounted".
await waitFor(() => byId(dom, "status-detail-dialog") !== null, "Detail dialog opened");
await waitFor(() => byId(dom, "markdown-bundle-btn")?.getAttribute("aria-disabled") === "false", "Overview panel download button ready");

services.artifactDownloads.busyStore.setBusy("markdown-bundle-btn", true, "Downloading...");
await waitFor(() => byId(dom, "markdown-bundle-btn").textContent === "Downloading...", "busy Copy applied");

// Switch tab. Switch back. (Overview persistent mount, but triggers StatusDetailDialog full
  // re-render)——busy Copy stays.
  click(dom, byId(dom, "detail-tab-events"));
await waitFor(() => byId(dom, "detail-panel-events").hidden === false, "Switched to events tab");
  click(dom, byId(dom, "detail-tab-overview"));
await waitFor(() => byId(dom, "detail-panel-overview").hidden === false, "Switched back to overview tab");
assert.equal(byId(dom, "markdown-bundle-btn").textContent, "Downloading...", "Switching tabs must not reject download text.");

  services.artifactDownloads.busyStore.setBusy("markdown-bundle-btn", false);
await waitFor(() => byId(dom, "markdown-bundle-btn").textContent === "Download Markdown ZIP", "Text restored after busy state");

  root.unmount();
  services.dispose();
  host.remove();
});
