import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// useRecentJobCover (Blueprint Â§6 new test â©). Coverage:
// - Cache reuse (module-level Map in image-loader.js, same URL+cacheVersion sends only one
//   fetch, second card hits cache directly);
// - Race condition protection (token): when items switch rapidly, only the last request result writes to state;
// - No revoke on unmount (Blueprint risk Â§8.3): must not call URL.revokeObjectURL after hook unmountâ
//   objectURL cache lifecycle is managed solely by image-loader.js's invalidateRecentJobImages
//   React unmount must never prematurely revoke a URL that other cards might still be using.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { useRecentJobCover } = await import("../src/pages/home/features/library/display/useRecentJobCover.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(10);
  }
assert.fail(`Wait timeout: ${description}`);
}

function installFetchAndObjectUrlMocks() {
  const fetchCalls = [];
  const revokeCalls = [];
  const createCalls = [];
  globalThis.fetch = async (url) => {
    fetchCalls.push(url);
    return {
      ok: true,
      blob: async () => ({ __mockBlob: url }),
    };
  };
  globalThis.URL.createObjectURL = (blob) => {
    const objectUrl = `blob:mock-${createCalls.length}-${blob.__mockBlob}`;
    createCalls.push(objectUrl);
    return objectUrl;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    revokeCalls.push(url);
  };
  return { fetchCalls, revokeCalls, createCalls };
}

function HookHost({ item, onUpdate }) {
  const coverUrl = useRecentJobCover(item);
  React.useEffect(() => {
    onUpdate(coverUrl);
  }, [coverUrl, onUpdate]);
  return null;
}

test("useRecentJobCover: same URL+cacheVersion hits module-level cache, no duplicate fetch", async () => {
  const { fetchCalls } = installFetchAndObjectUrlMocks();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const item = {
    job_id: "cover-job-1",
    thumbnail_url: "https://example.test/cover-a.png",
    updated_at: "2026-01-01T00:00:00Z",
    status: "succeeded",
  };

  const seenA = [];
  const seenB = [];
  React.startTransition(() => {
    root.render(React.createElement(React.Fragment, null,
      React.createElement(HookHost, { item, onUpdate: (url) => seenA.push(url) }),
      React.createElement(HookHost, { item: { ...item }, onUpdate: (url) => seenB.push(url) }),
    ));
  });

await waitFor(() => seenA.some(Boolean) && seenB.some(Boolean), "Both cards received cover URL");
assert.equal(fetchCalls.length, 1, "Both cards share same module-level cache, should only fetch once");
assert.equal(seenA.at(-1), seenB.at(-1), "Both cards received same objectURL");

  root.unmount();
  host.remove();
});

test("useRecentJobCover: progress changes during execution do not re-fetch cover (no flicker regression)", async () => {
  const { fetchCalls } = installFetchAndObjectUrlMocks();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const seen = [];
  const running1 = {
    job_id: "run-cover-flicker",
    thumbnail_url: "https://example.test/run-cover-flicker.png",
    status: "running",
    updated_at: "2026-01-01T00:00:00Z",
    progress: { current: 1, total: 10, percent: 10 },
  };
  root.render(React.createElement(HookHost, { item: running1, onUpdate: (url) => seen.push(url) }));
await waitFor(() => seen.some(Boolean), "First frame cover arrived during execution");
  const fetchesAfterFirst = fetchCalls.length;
assert.equal(fetchesAfterFirst, 1, "Should fetch cover once initially");

// Mock a polling patch: progress and updated_at changed, but job is still runningâcover should not
// be re-fetched (otherwise <img> src changes every tick and flickers).
  const running2 = { ...running1, updated_at: "2026-01-01T00:00:05Z", progress: { current: 5, total: 10, percent: 50 } };
  root.render(React.createElement(HookHost, { item: running2, onUpdate: (url) => seen.push(url) }));
  await wait(60);
assert.equal(fetchCalls.length, fetchesAfterFirst, "Progress/timestamp changes during execution should not re-fetch cover");

// To final state: should bust once to get potentially updated finished cover.
  const done = { ...running1, status: "succeeded", updated_at: "2026-01-01T00:00:10Z" };
  root.render(React.createElement(HookHost, { item: done, onUpdate: (url) => seen.push(url) }));
await waitFor(() => fetchCalls.length === fetchesAfterFirst + 1, "Should re-fetch cover (bust) at final state");

  root.unmount();
  host.remove();
});

test("useRecentJobCover: token prevents race conditions during rapid item switching, only last request writes state", async () => {
  const { fetchCalls } = installFetchAndObjectUrlMocks();
// Make first request intentionally slower than second to simulate "old request arrives late" race condition
  let resolveFirst;
  const firstGate = new Promise((resolve) => { resolveFirst = resolve; });
  const originalFetch = globalThis.fetch;
  let callIndex = 0;
  globalThis.fetch = async (url) => {
    const index = callIndex;
    callIndex += 1;
    if (index === 0) {
      await firstGate;
    }
    return originalFetch(url);
  };

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const seen = [];
  function Wrapper({ item }) {
    return React.createElement(HookHost, { item, onUpdate: (url) => seen.push(url) });
  }

  const itemSlow = { job_id: "race-job", thumbnail_url: "https://example.test/slow.png", updated_at: "v1" };
  const itemFast = { job_id: "race-job", thumbnail_url: "https://example.test/fast.png", updated_at: "v2" };

  root.render(React.createElement(Wrapper, { item: itemSlow }));
  await wait(20);
  root.render(React.createElement(Wrapper, { item: itemFast }));
await waitFor(() => seen.some((url) => url && url.includes("fast")), "Fast request (latest item) already written");

  resolveFirst();
  await wait(50);

assert.ok(!seen.at(-1)?.includes("slow"), "Slow request (old item) should not overwrite latest state (token race protection)");
  assert.equal(fetchCalls.length, 2);

  root.unmount();
  host.remove();
  globalThis.fetch = originalFetch;
});

test("useRecentJobCover: do not revoke objectURL on unmount (Risk Â§8.3)", async () => {
  const { revokeCalls } = installFetchAndObjectUrlMocks();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const item = {
    job_id: "cover-job-unmount",
    thumbnail_url: "https://example.test/cover-unmount.png",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const seen = [];
  root.render(React.createElement(HookHost, { item, onUpdate: (url) => seen.push(url) }));
await waitFor(() => seen.some(Boolean), "Cover URL arrived");

  root.unmount();
  await wait(30);

assert.equal(revokeCalls.length, 0, "Must not revoke on unmountâobjectURL cache managed only by invalidateRecentJobImages");

  host.remove();
});
