import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Upload dialog: choose one of two after completion ââ Translate directly / Save only (no auto-close to library).

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
    if (predicate()) {
      return;
    }
    await wait(15);
  }
assert.fail(`Timeout waiting: ${description}`);
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
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

test("Upload dialog: title hint + direct translation/store only after ready", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  click(dom, byId("library-add-pdf-btn"));
await waitFor(() => byId("translation-workflow-dialog") !== null, "Add dialog opened");
assert.equal(byId("translation-workflow-title").textContent, "Add PDF");
assert.match(byId("translation-workflow-desc").textContent, /direct translation|store/);

// Mock upload complete
  services.uploadViewActions.patch({ ready: true, actionSlotVisible: true });
await waitFor(() => byId("store-only-btn") && !byId("store-only-btn").classList.contains("hidden"), "Store only visible");
await waitFor(() => byId("upload-ready-hint") && !byId("upload-ready-hint").classList.contains("hidden"), "Ready hint visible");
assert.ok(byId("submit-btn"), "Direct translation button exists");
assert.match(byId("submit-btn").textContent, /direct translation|submit/);

// Dialog remains open (no auto-close)
assert.ok(byId("translation-workflow-dialog"), "Does not auto-close after ready");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Store only: close dialog and do not submit translation job", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

  click(dom, byId("library-add-pdf-btn"));
await waitFor(() => byId("translation-workflow-dialog") !== null, "Add dialog opened");

  let jobSubmitted = false;
  dom.window.document.addEventListener(APP_EVENTS.libraryJobCreated, () => { jobSubmitted = true; });

  services.uploadViewActions.patch({ ready: true, actionSlotVisible: true });
await waitFor(() => byId("store-only-btn") && !byId("store-only-btn").classList.contains("hidden"), "Store only visible");
  click(dom, byId("store-only-btn"));

await waitFor(() => byId("translation-workflow-dialog") === null, "Close dialog after store only");
  await wait(50);
assert.equal(jobSubmitted, false, "Store only does not submit translation job");

  root.unmount();
  services.dispose();
  host.remove();
});
