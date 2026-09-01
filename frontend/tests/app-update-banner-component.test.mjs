import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// AppUpdateBanner (Phase 3 dialogs group, Blueprint Â§5) Component-level test.
// Validation: Contract idStartup cache hit/Two paths missed. Manual check.
// loading/success/failure tristate, formatReleaseNotes render assertions, SettingsHubDialog
// "Update" tab button of + details dialog Merge MountAppShellHeader No old templates remain.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (introduced in Phase B) requires cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended) â implemented in jsdom window, but not
// copied to bare global like requestAnimationFrame; adding it here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
assert.fail(`Wait timeout: ${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function memoryCachePort(initial = { info: null, fresh: false }) {
  let value = initial;
  return {
    read: () => value,
    write: (info) => { value = { info, fresh: true }; },
  };
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
await waitFor(() => byId("app-shell"), "HomeApp first frame render");
  await wait(0);
  return { host, root };
}

// Phase C (shadcn refactor): SettingsHubDialog/AppUpdateBanner details dialog replaced with
// Radix Dialog: no longer forceMount Content, Closed: entire content unmounted (No longer
// native <dialog>.open Boolean attribute), Below, all use "is mounted" to check open state.
async function openUpdateTab() {
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "settings dialog opened");
  click(dom.window.document.querySelector('[data-settings-tab="update"]'));
  await wait(0);
}

async function openUpdateDialog() {
  await openUpdateTab();
  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog") !== null, "Open Update Details");
}

test("AppUpdateBannerContract id、AppShellHeader No duplicate templates left.", async () => {
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: false,
  });
  const { host, root } = await mountHome(services);

// "app-update-dialog"/"app-update-status"/"app-update-check-btn" mounted in
// AppUpdateBanner Fetch user details. Use `/api/user`. Parse JSON. Display. dialog(local useAppUpdateDialogOpen driven
// Radix Dialog, Phase C Not after transfusion forceMount), Opens only on click. "Check for Updates" After button
// Only exists in DOMâuse openUpdateDialog() instead of openUpdateTab(), Apply this layer
// triggering it ensures compliance with "contract id exists one by one" Assertion precondition.
  await openUpdateDialog();
  for (const id of ["app-update-btn", "app-update-dialog", "app-update-status", "app-update-check-btn"]) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }
  // Unique:AppShellHeader Old skeleton cleaned,#app-update-dialog Only one should exist
// (Blueprint Â§5: Duplicate id Violates visual baseline/gate).
  assert.equal(dom.window.document.querySelectorAll("#app-update-dialog").length, 1);
  assert.equal(dom.window.document.querySelectorAll("#app-update-btn").length, 1);

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner：composition Auto-check disabled by default.(Test isolation,No internet connection.)", async () => {
  let fetchCalled = false;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
// Do not pass appUpdateAutoCheckEnabledâDefault value verified safe (false).
    fetchLatestRelease: async () => {
      fetchCalled = true;
      return { tag_name: "v99.0.0" };
    },
    appUpdateCachePort: memoryCachePort({ info: null, fresh: false }),
  });
  const { host, root } = await mountHome(services);
  await openUpdateTab();

  await wait(1400);
assert.equal(fetchCalled, false, "Default (Not explicitly enabled.) Background self-check network request must not trigger.");
  assert.equal(byId("app-update-btn").dataset.updateState, "idle");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBannerCache hit enabled(fresh)Show directly,No network requests initiated.", async () => {
  let fetchCalled = false;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    fetchLatestRelease: async () => {
      fetchCalled = true;
      return { tag_name: "v99.0.0" };
    },
    appUpdateCachePort: memoryCachePort({
      fresh: true,
      info: {
        checkedAt: Date.now(),
        currentVersion: "1.0.0",
        latestVersion: "9.9.9",
        hasUpdate: true,
        title: "RetainPDF 9.9.9",
        body: "## New version\n- Fix known issues.",
        htmlUrl: "https://example.com/releases/9.9.9",
      },
    }),
  });
  const { host, root } = await mountHome(services);
  await openUpdateTab();

await waitFor(() => byId("app-update-btn").dataset.updateState === "available", "Display on cache hit. available state");
  assert.equal(byId("app-update-btn").classList.contains("has-update"), true);

  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog") !== null, "Details");
  assert.match(byId("app-update-dialog").querySelector("h2").textContent, /RetainPDF 9\.9\.9/);
assert.equal(byId("app-update-dialog").querySelector("p").textContent, "Current 1.0.0 Â· Latest 9.9.9");
  assert.equal(byId("app-update-dialog").querySelector(".app-update-link").classList.contains("hidden"), false);

  await wait(1400);
  assert.equal(fetchCalled, false, "Skip background self-check network request when cache fresh.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBannerStartup cache miss,1200ms Background self-check and persist. store", async () => {
  const cachePort = memoryCachePort({ info: null, fresh: false });
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    fetchLatestRelease: async () => ({ tag_name: "v0.0.1", name: "RetainPDF 0.0.1", body: "patch", html_url: "https://example.com/releases/0.0.1" }),
    appUpdateCachePort: cachePort,
  });
  const { host, root } = await mountHome(services);
  await openUpdateTab();

assert.equal(byId("app-update-btn").dataset.updateState, "idle", "Preserve before background timer triggers. idle state");
  await waitFor(() => byId("app-update-btn").dataset.updateState !== "idle", "1200ms Background self-check complete, status transitioned.");
  assert.equal(cachePort.read().fresh, true, "Write self-check results to cache.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBannerManual check. loading â Success(available/latest) Three-state with formatReleaseNotes rendering", async () => {
  const check1 = deferred();
  let callCount = 0;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    // fresh Skip cache background self-check timer.,Test manual click path only.
    appUpdateCachePort: memoryCachePort({ fresh: true, info: { checkedAt: Date.now(), currentVersion: "1.0.0", latestVersion: "1.0.0", hasUpdate: false } }),
    fetchLatestRelease: async () => {
      callCount += 1;
      return check1.promise;
    },
  });
  const { host, root } = await mountHome(services);
  await openUpdateDialog();

  click(byId("app-update-check-btn"));
await waitFor(() => byId("app-update-btn").dataset.updateState === "checking", "Manual Check loading state");
  assert.equal(byId("app-update-status").classList.contains("hidden"), false);
assert.equal(byId("app-update-status").textContent, "Checking GitHub Releases...");
assert.equal(byId("app-update-dialog").querySelector("h2").textContent, "Checking for updates");

  check1.resolve({
    tag_name: "v4.2.0",
    name: "RetainPDF 4.2.0",
    body: "## Release notes\n- Fix status display\n**Important**Upgrade\n`fix-1`",
    html_url: "https://example.com/releases/4.2.0",
  });
await waitFor(() => byId("app-update-btn").dataset.updateState === "available", "Enter after parsing. available state");
  assert.equal(byId("app-update-btn").classList.contains("has-update"), true);
  assert.equal(callCount, 1);

// formatReleaseNotes rendering assertion: Strip heading hashes. Convert list items. â¢Bold/Strip code markers.
  const notesText = byId("app-update-dialog").querySelector(".app-update-notes").textContent;
  assert.equal(notesText, "Release Notes\n• Fix status display.\nImportant: Please upgrade\nfix-1");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBannerManual check failure: display error message.", async () => {
  const check1 = deferred();
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    appUpdateCachePort: memoryCachePort({ fresh: true, info: { checkedAt: Date.now(), currentVersion: "1.0.0", latestVersion: "1.0.0", hasUpdate: false } }),
    fetchLatestRelease: async () => check1.promise,
  });
  const { host, root } = await mountHome(services);
  await openUpdateDialog();

  click(byId("app-update-check-btn"));
await waitFor(() => byId("app-update-btn").dataset.updateState === "checking", "Manual check enters loading state");

  check1.reject(new Error("Network unreachable."));
await waitFor(() => byId("app-update-btn").dataset.updateState === "error", "Enter after failure error state");
  assert.equal(byId("app-update-btn").classList.contains("has-update"), false);
assert.equal(byId("app-update-status").textContent, "Check failed");
  assert.equal(byId("app-update-dialog").querySelector(".app-update-notes").textContent, "Network unreachable. Check connection.");

  root.unmount();
  services.dispose();
  host.remove();
});
