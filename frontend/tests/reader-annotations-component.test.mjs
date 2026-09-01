import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// React component-level tests: loaded directly via tests/helpers/jsx-loader.mjs esbuild hook .jsx

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
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
// copied to bare global like requestAnimationFrame, we supplement here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { ANNOTATION_KIND_META } = await import("../src/js/reader/annotations/view-model.js");
const { mountReaderAnnotationsApp } = await import("../src/js/islands/reader-annotations/reader-annotations-app.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polling wait,Replace fragile hardcoded values wait(50):When running full test suite concurrently CPU Tight,Fixed millisecond
// React commit / async loadAnnotations not finalized yet (added by homepage card redesign.
// Render load overwhelmed.)。predicate Passes when predicate returns true.
async function waitUntil(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
assert.fail(`Timeout waiting for: {description});
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function makeAnnotations() {
  return [
    {
      favoriteId: "fav-1",
      pageIdx: 0,
      blockId: "b-1",
      kind: "sentence",
quoteText: "First annotation original text",
      translatedQuoteText: "",
note: "Existing note",
      createdAt: "2026-07-01T10:00:00Z",
    },
    {
      favoriteId: "fav-2",
      pageIdx: 0,
      blockId: "b-2",
      kind: "data",
quoteText: "Second annotation original text",
translatedQuoteText: "Second annotation translation",
      note: "",
      createdAt: "2026-07-01T11:00:00Z",
    },
    {
      favoriteId: "fav-3",
      pageIdx: 2,
      blockId: "b-3",
      kind: "figure",
quoteText: "Third annotation original text",
      translatedQuoteText: "",
      note: "",
      createdAt: "2026-07-02T09:00:00Z",
    },
  ];
}

test("Annotation Panel: Group rendering, note editing, optimistic deletion, and Markdown export", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  const deleteCalls = [];
  const saveCalls = [];
  const exportCalls = [];
  const jumpCalls = [];
  const ports = {
    subscribeOpen: (subscriber) => {
      subscriber(true);
      return () => {};
    },
    loadAnnotations: async () => makeAnnotations(),
    deleteAnnotation: async (favoriteId) => {
      deleteCalls.push(favoriteId);
      return true;
    },
    saveNote: async (annotation, note) => {
      saveCalls.push([annotation.favoriteId, note]);
      return { ...annotation, note };
    },
    jumpToAnchor: (anchor) => {
      jumpCalls.push(anchor);
    },
    exportMarkdown: async (text) => {
      exportCalls.push(text);
      return true;
    },
documentTitle: () => "Test document",
  };

  const app = mountReaderAnnotationsApp(host, ports);
// Await async loadAnnotations settled; all three cards rendered. (fixed wait insufficient at full load.)
  await waitUntil(() => host.querySelectorAll(".reader-annotations-item").length === 3, "Render three annotation cards.");

  // Base rendering:Group titles, cards, badges, existing notes
assert.ok(host.querySelector(".reader-annotations-panel"), "Panel rendered");
  assert.equal(host.querySelector(".reader-annotations-count")?.textContent, "3 Annotations");
  const groupTitles = [...host.querySelectorAll(".reader-annotations-group-title")];
  assert.equal(groupTitles.length, 2, "2 Group Titles");
assert.deepEqual(groupTitles.map((node) => node.textContent), ["Page 1", "Page 3"]);
  const items = [...host.querySelectorAll(".reader-annotations-item")];
  assert.equal(items.length, 3, "Three annotation cards");
  assert.deepEqual(
    [...host.querySelectorAll(".reader-annotations-kind")].map((node) => node.textContent),
    [
      ANNOTATION_KIND_META.sentence.label,
      ANNOTATION_KIND_META.data.label,
      ANNOTATION_KIND_META.figure.label,
    ],
    "kind Badge copy correct",
  );
  assert.ok(host.querySelector(".reader-annotations-kind.is-data"), "Badge Strap is-{kind} Class Name");
assert.equal(host.querySelector(".reader-annotations-note")?.textContent, "Existing note");
assert.equal(host.querySelector(".reader-annotations-translated")?.textContent, "Second annotation translation");

  // Add note:Appear textarea,Input protocol
  const secondItem = host.querySelectorAll(".reader-annotations-item")[1];
  click(secondItem.querySelector(".reader-annotations-note-add"));
  await waitUntil(() => secondItem.querySelector(".reader-annotations-note-input"), "Editing state appears textarea");
  const textarea = secondItem.querySelector(".reader-annotations-note-input");
assert.ok(textarea, "Edit state shows textarea");
  const valueSetter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    "value",
  ).set;
valueSetter.call(textarea, "New note");
  textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(30);
  click(secondItem.querySelector(".reader-annotations-note-save"));
await waitUntil(() => saveCalls.length === 1, "saveNote called");
assert.deepEqual(saveCalls, [["fav-2", "New note"]], "saveNote called");
  const noteTexts = [...host.querySelectorAll(".reader-annotations-note")].map((node) => node.textContent);
assert.ok(noteTexts.includes("New note"), "Note text updated");

// Export Markdown: contains "# " Title and "> " blockquote, Button briefly becomes "Copied"
  click(host.querySelector(".reader-annotations-export"));
// Wait until button actually becomes "Copied" (async export complete + after re-render), rather than guessing fixed milliseconds.
await waitUntil(() => host.querySelector(".reader-annotations-export")?.textContent === "Copied", "Copied");
  assert.equal(exportCalls.length, 1, "exportMarkdown Called once.");
  assert.ok(exportCalls[0].includes("# "), "Markdown Include title");
  assert.ok(exportCalls[0].includes("> "), "Markdown Contains block quote");
assert.equal(host.querySelector(".reader-annotations-export")?.textContent, "Copied");

// Delete: Optimistically remove AND deleteAnnotation invoked
  click(host.querySelector(".reader-annotations-item .reader-annotations-remove"));
  await waitUntil(() => host.querySelectorAll(".reader-annotations-item").length === 2, "Optimistic card removal");
assert.equal(host.querySelectorAll(".reader-annotations-item").length, 2, "Card optimistically removed");
assert.deepEqual(deleteCalls, ["fav-1"], "deleteAnnotation called");

// Navigate: pass annotationAnchor result
  click(host.querySelector(".reader-annotations-item .reader-annotations-locate"));
await waitUntil(() => jumpCalls.length === 1, "jumpToAnchor called");
  assert.deepEqual(jumpCalls, [{ pageIdx: 0, blockId: "b-2" }]);

  app.unmount();
  host.remove();
});
