import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Reader drawer shell and topbar action group (React version): replaces the old reader.test.mjs
// "reader side drawer controls favorites" — open/close semantics migrated from side-drawers.js
// drawer store + React rendering, here asserts: mutual exclusion toggle, is-open/inert, topbar buttons
// aria-expanded/is-active, favorites never inert, close button; and download menu's
// availability/disabled reasons (equivalent assertions of old download-actions DOM controller).

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
globalThis.window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://retainpdf.local:41000/api/v1" };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
// Radix Presence/Tabs (Phase B) require cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation has ended) — jsdom's window has implementation, but not
// copied to bare global like requestAnimationFrame, we supplement here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createReaderDrawerStore } = await import("../src/pages/reader/legacy/state/drawer-store.js");
const { ReaderTopbarActions } = await import("../src/pages/reader/legacy/components/ReaderTopbarActions.jsx");
const {
  ReaderAiDrawer,
  ReaderAnnotationsDrawer,
  ReaderFavoritesDrawer,
  ReaderMarkdownDrawer,
} = await import("../src/pages/reader/legacy/components/ReaderSideDrawers.jsx");

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
assert.fail(`Timeout waiting for: {description});
}

const documentRef = dom.window.document;
const byId = (id) => documentRef.getElementById(id);

const { ReaderDownloadMenu } = await import("../src/pages/reader/legacy/components/ReaderDownloadMenu.jsx");

// Single mount, shared across file (consistent with real page: one store manages four drawers + topbar).
// Additionally mount a copy of download menu with context (equivalent to form after boot injection) —
// under node:test, second createRoot won't be scheduled, all merged into this tree.
const drawerStore = createReaderDrawerStore();
const host = documentRef.createElement("div");
documentRef.body.appendChild(host);
createRoot(host).render(React.createElement(
  React.Fragment,
  null,
  React.createElement(ReaderTopbarActions, { drawerStore, downloadContext: null }),
  React.createElement(ReaderFavoritesDrawer, { drawerStore }),
  React.createElement(ReaderAnnotationsDrawer, { drawerStore, ports: null }),
  React.createElement(ReaderMarkdownDrawer, { drawerStore }),
  React.createElement(ReaderAiDrawer, { drawerStore, chatPorts: null }),
  React.createElement(
    "div",
    { "data-testid": "menu-with-context" },
    React.createElement(ReaderDownloadMenu, {
      context: {
        fetchProtected: async () => ({ ok: true }),
        jobId: "job-reader",
        jobPayload: { job_id: "job-reader", output_pdf_ready: true },
        manifestPayload: {
          items: [
            { artifact_key: "source_pdf", ready: true, resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf" },
            { artifact_key: "pdf", ready: true, resource_path: "/api/v1/jobs/job-reader/artifacts/pdf" },
          ],
        },
      },
    }),
  ),
));
await waitFor(() => byId("reader-favorites-drawer"), "drawer mounted");

test("drawer store: mutual exclusion open/close and subscription notification", () => {
  const changes = [];
  const unsubscribe = drawerStore.subscribe((active) => changes.push(active));
  drawerStore.open("favorites");
  assert.equal(drawerStore.active(), "favorites");
  drawerStore.toggle("ai");
  assert.equal(drawerStore.active(), "ai");
  drawerStore.toggle("ai");
  assert.equal(drawerStore.active(), "");
  drawerStore.open("markdown");
drawerStore.close("favorites"); // close unrelated drawer: active unchanged
  assert.equal(drawerStore.active(), "markdown");
  drawerStore.close();
  assert.equal(drawerStore.active(), "");
  unsubscribe();
  assert.deepEqual(changes, ["favorites", "ai", "", "markdown", "markdown", ""]);
});

test("Open favorites: is-open + topbar button highlighted, favorites never inert", async () => {
  drawerStore.open("favorites");
await waitFor(() => byId("reader-favorites-drawer").classList.contains("is-open"), "favorites opened");
  assert.equal(byId("reader-favorites-drawer").hasAttribute("inert"), false);
  assert.equal(byId("reader-favorites-toggle-btn").getAttribute("aria-expanded"), "true");
  assert.ok(byId("reader-favorites-toggle-btn").classList.contains("is-active"));
// Other drawers closed and inert (closed drawers other than favorites are not interactive)
  assert.ok(!byId("reader-ai-drawer").classList.contains("is-open"));
  assert.equal(byId("reader-ai-drawer").hasAttribute("inert"), true);
  assert.equal(byId("reader-markdown-drawer").hasAttribute("inert"), true);
});

test("Mutual exclusion toggle: opening ai drawer closes favorites", async () => {
  drawerStore.open("favorites");
await waitFor(() => byId("reader-favorites-drawer").classList.contains("is-open"), "favorites opened");
  byId("reader-ai-toggle-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => byId("reader-ai-drawer").classList.contains("is-open"), "ai opened");
  assert.ok(!byId("reader-favorites-drawer").classList.contains("is-open"));
  assert.equal(byId("reader-favorites-toggle-btn").getAttribute("aria-expanded"), "false");
  assert.equal(byId("reader-ai-drawer").hasAttribute("inert"), false);
// favorites even when closed is not inert (pinned excerpt overlay interactions depend on it)
  assert.equal(byId("reader-favorites-drawer").hasAttribute("inert"), false);
});

test("Close button: click × to close current drawer", async () => {
  drawerStore.open("markdown");
await waitFor(() => byId("reader-markdown-drawer").classList.contains("is-open"), "markdown opened");
  byId("reader-markdown-close-btn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await waitFor(() => !byId("reader-markdown-drawer").classList.contains("is-open"), "markdown closed");
  assert.equal(drawerStore.active(), "");
});

test("Download menu: buttons disabled and reason given when context missing", () => {
  for (const action of ["source", "sideBySide", "translated"]) {
    const button = byId(`reader-download-${action}-btn`);
    assert.equal(button.disabled, true, action);
    assert.equal(button.getAttribute("aria-disabled"), "true");
    assert.match(button.title, /PDF/);
  }
});

test("Download menu: buttons highlighted and have download title when list available", async () => {
  const menuHost = documentRef.querySelector('[data-testid="menu-with-context"]');
// Note: there are two menus in the page (topbar null-context + this one), jsdom's #id query will
// short-circuit to the first one; use [id="..."] attribute selector to limit subtree.
await waitFor(() => menuHost.querySelector('[id="reader-download-source-btn"]'), "menu with context mounted");
  const sourceBtn = menuHost.querySelector('[id="reader-download-source-btn"]');
  const sideBtn = menuHost.querySelector('[id="reader-download-sideBySide-btn"]');
  const translatedBtn = menuHost.querySelector('[id="reader-download-translated-btn"]');
  assert.equal(sourceBtn.disabled, false);
assert.match(sourceBtn.title, /Download original PDF/);
  assert.equal(sideBtn.disabled, false);
assert.match(sideBtn.title, /Download side-by-side PDF/);
  assert.equal(translatedBtn.disabled, false);
assert.match(translatedBtn.title, /Download translated PDF/);
});
