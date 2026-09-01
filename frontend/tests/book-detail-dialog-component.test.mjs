import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Book detail popup (ref PDF_MD_lib BookDetailModal) component test: Tap card to open.
// Metadata rendering, read status toggle patchDocumentCollection/Translated action sets differ.
//
// Each test uses a brand new JSDOM (second createRoot attempt on same jsdom hangs).

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
    const value = predicate();
    if (value) {
      return value;
    }
    await wait(15);
  }
assert.fail(`Timeout waiting for: ${description}`);
}

function click(dom, element) {
// Radix Tabs Trigger relies on mousedown Up, dispatching only click fails tab switching.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
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
await waitFor(() => dom.window.document.getElementById("app-shell"), "HomeApp first frame rendered");
  await wait(0);
  return { services, root, host };
}

test("Collection card opens book details: metadata + Toggle read status + Translate/Read Original, Unannotated Reading", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="true"]'),
    "Collection card in place.",
  );
  const documentId = card.getAttribute("data-document-id");
  click(dom, card);

  const dlg = await waitFor(() => byId("book-detail-dialog"), "Open book details popup");
  // Title defaults to read-only heading.(Not a persistent input field.),Input field appears only on edit.
await waitFor(() => dlg.querySelector(".book-detail-title")?.textContent?.trim(), "Title in place");
  assert.equal(byId("book-detail-title-input"), null, "Set default mode read-only.,Untitled input");
assert.ok(dlg.querySelector(".book-detail-status")?.textContent.includes("Not Translated"), "collection shows not translated");
  // Lightweight Empty State + StageFlow preview (no real yet job, without embedding the full StatusCard）
  assert.ok(byId("book-detail-translate-progress"), "Collection has translation progress panel.");
assert.ok(byId("book-detail-stage-flow"), "Untranslated progress area has StageFlow preview");
  assert.equal(byId("book-detail-job-status-card"), null, "Untranslated; no embed. StatusCard");
// Holdings: Translation available. + Read Original, No side-by-side reading
  assert.ok(byId("book-detail-translate-btn"), "Holdings have Translate button.");
  assert.ok(byId("book-detail-read-source-btn"), "Read original");
  assert.equal(byId("book-detail-compare-btn"), null, "No parallel reading in collection.");
// Click "Edit" to enter title/edit tags
  click(dom, byId("book-detail-edit-btn"));
  await waitFor(() => byId("book-detail-title-input"), "Clicking edit displays the title input field");

  // Read status toggle. → patchDocument(mock),Button activates
  const { getMockDocument } = await import("../src/js/mock/documents.js");
  const readBtns = dlg.querySelectorAll(".book-detail-reading-btn");
const doneBtn = Array.from(readBtns).find((b) => b.textContent === "Finished");
  click(dom, doneBtn);
  await waitFor(() => doneBtn.classList.contains("is-active"), "becomes active after reading");
  await waitFor(() => getMockDocument(documentId).reading_status === "done", "patchDocument Write to database reading_status=done");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Translation card opened book details:Side-by-side reading,No translation button", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

// In mock, att-001/scl-002 are Awaiting synthesis. book is succeeded Translated documents
  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="false"][data-status="succeeded"]'),
    "Translated card ready.",
  );
  click(dom, card);

const dlg = await waitFor(() => byId("book-detail-dialog"), "Book detail popup opened");
  // Default to「Overview」Workflow dialog should not pop up
  assert.equal(
    services.stores.dialog.getSnapshot().open,
    false,
    "Do not auto-open workflow popup on book detail open.",
  );
// Translated books default to "Translation" tab. Progress card updates DOM immediately.
  await waitFor(
() => dlg.querySelector(".book-detail-status")?.textContent?.includes("Completed"),
    "Show Completed",
  );
const statusCard = await waitFor(() => byId("book-detail-job-status-card"), "StatusCard embedded in Translation tab");
  assert.ok(statusCard.classList.contains("bd-job-status-card"), "Detail-specific progress card");
assert.equal(statusCard.getAttribute("data-embedded"), "true", "embedded mode");
  assert.ok(
    statusCard.closest("#book-detail-panel-translate"),
    "StatusCard Translating... Tab inside panel",
  );
  // Book details internal structure (bd-job-status-*CSS height set. → skipped: JavaScript, add when dynamic resizing needed.
  assert.ok(statusCard.classList.contains("bd-job-status-card"), "bd-job-status-card Root");
  assert.ok(statusCard.querySelector(".bd-job-status-inner"), "independent inner, non- status-card-shell");
  assert.ok(statusCard.querySelector(".bd-job-status-main"), "Fixed-height main area");
  assert.ok(
    statusCard.querySelector(".status-stage-flow .status-stage-step"),
    "Includes stage flow",
  );
  assert.equal(statusCard.querySelector(".status-card-shell"), null, "Bypass main flow shell");
assert.equal(statusCard.querySelector(".status-progress-hero"), null, "Do not use main flow hero");
  await waitFor(
    () => `${statusCard.getAttribute("data-status") || ""}` === "succeeded"
      || statusCard.querySelector(".status-stage-step.is-active, .status-stage-step.is-done"),
    "StatusCard enter completion/Stage Highlight",
  );
  const doneStep = statusCard.querySelector(
    '.status-stage-flow .status-stage-step[data-stage-key="done"]',
  );
  assert.ok(
    doneStep?.classList.contains("is-active")
      || doneStep?.classList.contains("is-selected")
      || doneStep?.classList.contains("is-done"),
    "Completed Phase Highlight",
  );
  const valueText = statusCard.querySelector(".bd-job-status-value")?.textContent?.trim();
assert.ok(valueText && valueText !== "Preparing", `Completed state missing progress text.: ${valueText}`);
  // Detail progress card has been changed from ring changed to bar LayoutStatusCardEmbedded：.bd-job-status-percent）
  const pct = statusCard.querySelector(".bd-job-status-percent")?.textContent?.trim();
  assert.equal(pct, "100%", "Completed progress bar 100%");
  assert.ok(
    statusCard.querySelector(".bd-job-status-bar.is-done"),
"Completed state progress bar is-done",
  );
  // Workflow still fails to trigger.
  assert.equal(
    services.stores.dialog.getSnapshot().open,
    false,
    "Switch Translation Tab / After loading progress, workflow popup still does not open.",
  );
  assert.ok(byId("book-detail-compare-btn"), "Translated has side‑by‑side reading");
  assert.equal(byId("book-detail-translate-btn"), null, "Translated. No translate button.");
  assert.ok(byId("book-detail-read-source-btn"), "Still readable as original.");

  root.unmount();
  services.dispose();
  host.remove();
});
