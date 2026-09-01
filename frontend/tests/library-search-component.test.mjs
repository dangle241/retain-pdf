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
// Radix Presence/Tabs (introduced in Phase B) require cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation has ended) — jsdom's window has the implementation, but it's not
// copied to the bare global like requestAnimationFrame, we supplement it here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { mountLibrarySearchApp } = await import("../src/js/islands/library-search/library-search-app.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("library search panel: render hit highlights and document lines, status toggle calls PATCH", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const patchCalls = [];
  let deliverQuery = null;
  const ports = {
    subscribeQuery: (subscriber) => {
      deliverQuery = subscriber;
      subscriber("");
      return () => {};
    },
    searchLibrary: async (q) => ({
      hits: [{
        document_id: "doc-a",
        job_id: "job-a",
        page_idx: 4,
        block_id: "b-1",
        source_snippet: `hit for [${q}] here`,
        translated_snippet: "",
      }],
    }),
    fetchDocumentList: async () => ({
      documents: [{
        document_id: "doc-a",
title: "test document",
        source_filename: "test.pdf",
        page_count: 8,
        active_job_id: "job-a",
        reading_status: "unread",
tags: ["test"],
      }],
    }),
    patchDocument: async (documentId, payload) => {
      patchCalls.push([documentId, payload]);
      return {};
    },
    openReader: () => {},
  };

  const app = mountLibrarySearchApp(host, ports);
// When running tests in parallel, process load varies; fixed short wait may get null before subscribe occurs;
// Poll until the island completes subscription (deliverQuery ready) before continuing.
  {
    const deadline = Date.now() + 3000;
    while (typeof deliverQuery !== "function" && Date.now() < deadline) {
      await wait(20);
    }
  }
assert.equal(typeof deliverQuery, "function", "island has subscribed to query port");
assert.equal(host.querySelector(".lib-search-panel"), null, "do not render panel for empty query");

deliverQuery("test");
// Search has debounce + async fetching; fixed 400ms is not enough under heavy concurrency. Poll until hit snippets are actually rendered
// (panel div appears first, hit content fills later; waiting only for panel is not enough).
  {
    const deadline = Date.now() + 3000;
    while (!host.querySelector(".lib-search-snippet mark") && Date.now() < deadline) {
      await wait(20);
    }
  }

assert.ok(host.querySelector(".lib-search-panel"), "panel rendered");
assert.equal(host.querySelector(".lib-search-snippet mark")?.textContent, "test");
assert.equal(host.querySelector(".lib-search-doc-title")?.textContent, "test document");
assert.equal(host.querySelector(".lib-search-doc-status")?.textContent, "unread");

  host.querySelector(".lib-search-doc-status").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true }),
  );
  {
// Wait for optimistic update (setState + re-render) to actually change status text to "reading", instead of guessing fixed milliseconds.
    const deadline = Date.now() + 3000;
while (host.querySelector(".lib-search-doc-status")?.textContent !== "reading" && Date.now() < deadline) {
      await wait(20);
    }
  }
  assert.deepEqual(patchCalls, [["doc-a", { reading_status: "reading" }]]);
assert.equal(host.querySelector(".lib-search-doc-status")?.textContent, "reading", "optimistic update effective");

  app.unmount();
  host.remove();
});
