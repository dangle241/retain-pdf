import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// ReaderDialog has been changed to "navigate to reader.html", no longer mounts iframe dialog.

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "CustomEvent",
    "Event",
    "Node",
    "MutationObserver",
    "NodeFilter",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(15);
  }
assert.fail(Timeout waiting for: {description}`);
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
await waitFor(() => dom.window.document.getElementById("app-shell"), "HomeApp first frame");
  await wait(0);
  return { services, root, host };
}

afterEach(async () => {
  const { setReaderNavigateForTests } = await import(
    "../src/pages/home/features/reader/navigate-to-reader.ts"
  );
  setReaderNavigateForTests(null);
});

test("openReaderRequested: jump to reader.html?job_id= (non-iframe)", async () => {
  const dom = makeDom("?mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../src/pages/home/features/reader/navigate-to-reader.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

assert.equal(dom.window.document.getElementById("reader-dialog"), null, "No longer mounts reading dialog");

  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { jobId: "job-demo-1", pageIdx: null, blockId: "" },
    }),
  );

await waitFor(() => hits.assign.length > 0, "Should navigate to reading page");
  assert.match(hits.assign[0], /reader\.html\?.*job_id=job-demo-1/);
assert.equal(hits.replace.length, 0, "Event open uses assign, not replace");

  root.unmount();
  services.dispose();
  host.remove();
});

test("openReaderRequested: collection document_id navigates to read original", async () => {
  const dom = makeDom("?mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../src/pages/home/features/reader/navigate-to-reader.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { documentId: "doc-abc", pageIdx: null, blockId: "" },
    }),
  );

await waitFor(() => hits.assign.length > 0, "Should navigate to document reading");
  assert.match(hits.assign[0], /reader\.html\?.*document_id=doc-abc/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("Deep link ?view=reader&job_id=: replace to reader.html", async () => {
  const dom = makeDom("?view=reader&job_id=job-deep&mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../src/pages/home/features/reader/navigate-to-reader.ts"
  );
// Must inject before boot: deep link is triggered in ReaderDialog mount effect
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);

await waitFor(() => hits.replace.length > 0, "Deep link should replace");
  assert.match(hits.replace[0], /reader\.html\?.*job_id=job-deep/);

  root.unmount();
  services.dispose();
  host.remove();
});
