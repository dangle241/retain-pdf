import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Component-level tests for GlossariesDialog (Phase 3 dialogs group, Blueprint Â§3).
// Verify: contract idLoad list/selection/Create draft, save name fallback and
// "Fixed/Preferred translation missing." Validate CSV Import, parsing CSV Export, refreshWorkflowGlossaries
// Reverse callback assertion (mock workflow domain), APP_EVENTS.refreshGlossaries triggers refresh.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (introduced in Phase B) require cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended) â implemented on jsdom window, but not
// Copied to bare global like requestAnimationFrame; adding it here as well.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

// HomeApp.jsx renders <download-toast></download-toast> Placeholder (Blueprint Â§7
// artifact-downloads domain, outside this agent's scope), Actual custom element class
// (src/js/components/feedback/download-toast.js)Old World js/components/**,
// architecture-boundaries gate prohibits src/pages/** importsâComponent itself not yet in
// React Register global. Register minimal here. stub(only setState/hide Two public methods,
// Matches public contract of real implementation.),Isolate current domain.(CSV Export)Test,Does not indicate resolved.
// artifact-downloads Field wiring notch(See discovery notes at the end of the test file)。
if (!dom.window.customElements.get("download-toast")) {
  dom.window.customElements.define("download-toast", class extends dom.window.HTMLElement {
    setState() {}
    hide() {}
  });
}

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");
const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

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

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(element, value) {
  const proto = element.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function selectOption(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function mockGlossaryApi(overrides = {}) {
  const calls = {
    fetchGlossaries: [],
    fetchGlossary: [],
    createGlossary: [],
    updateGlossary: [],
    deleteGlossary: [],
    exportGlossaryCsv: [],
    parseGlossaryCsv: [],
    refreshWorkflowGlossaries: [],
  };
  const state = {
    items: [{ glossary_id: "g-1", name: "量子化学术语", entry_count: 2 }],
    detail: {
      glossary_id: "g-1",
name: "Quantum Chemistry Terms",
      entries: [
        { source: "Hartree-Fock", target: "", level: "preserve", match_mode: "case_insensitive", context: "", note: "保留英文" },
        { source: "density functional theory", target: "密度泛函理论", level: "canonical", match_mode: "case_insensitive", context: "", note: "" },
      ],
    },
  };
  const api = {
    fetchGlossaries: async () => {
      calls.fetchGlossaries.push(true);
      return { items: state.items };
    },
    fetchGlossary: async (glossaryId) => {
      calls.fetchGlossary.push(glossaryId);
      return state.detail;
    },
    createGlossary: async (_apiPrefix, payload) => {
      calls.createGlossary.push(payload);
      const glossary_id = "g-new";
      state.items = [...state.items, { glossary_id, name: payload.name, entry_count: payload.entries.length }];
      return { glossary_id, ...payload };
    },
    updateGlossary: async (_apiPrefix, glossaryId, payload) => {
      calls.updateGlossary.push({ glossaryId, payload });
      return { glossary_id: glossaryId, ...payload };
    },
    deleteGlossary: async (_apiPrefix, glossaryId) => {
      calls.deleteGlossary.push(glossaryId);
      state.items = state.items.filter((item) => item.glossary_id !== glossaryId);
      return { glossary_id: glossaryId, deleted: true };
    },
    exportGlossaryCsv: async (_apiPrefix, glossaryId) => {
      calls.exportGlossaryCsv.push(glossaryId);
      return {
        headers: { get: (name) => (name === "content-disposition" ? `attachment; filename="${glossaryId}.csv"` : null) },
        body: undefined,
        blob: async () => ({ size: 42, kind: "csv-blob" }),
      };
    },
    parseGlossaryCsv: async (_apiPrefix, csvText) => {
      calls.parseGlossaryCsv.push(csvText);
      return {
        entry_count: 1,
        entries: [{ source: "parsed-term", target: "解析术语", level: "canonical", match_mode: "case_insensitive", context: "", note: "" }],
      };
    },
    refreshWorkflowGlossaries: async (options) => {
      calls.refreshWorkflowGlossaries.push(options);
    },
    ...overrides,
  };
  return { api, calls, state };
}

function createServices({ glossaryOverrides = {} } = {}) {
  const { api, calls, state } = mockGlossaryApi(glossaryOverrides);
  const services = createHomeComposition({
    fetchGlossaries: api.fetchGlossaries,
    fetchGlossary: api.fetchGlossary,
    createGlossary: api.createGlossary,
    updateGlossary: api.updateGlossary,
    deleteGlossary: api.deleteGlossary,
    exportGlossaryCsv: api.exportGlossaryCsv,
    parseGlossaryCsv: api.parseGlossaryCsv,
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
// refreshWorkflowGlossaries is workflow Domain reverse callback,composition.js Internally connects to
// features.workflowFeature.loadGlossaryOptionsââReplace this function directly,assert
// GlossariesDialog save/Indeed called after deletion.(Blueprint Â§3/Â§8 Dependency matrix coupling points).
  services.features.workflowFeature.loadGlossaryOptions = api.refreshWorkflowGlossaries;
  return { services, calls, state };
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

// 3a workflow Also called on domain startup. fetchGlossaries(Populate glossary dropdown,composition.js
// Share same injection point)——this domain"Trigger list load on dialog open."Class assertions cannot use absolute values.
// 1,Wait for workflow Initial load stable,Baseline recorded.,Use baseline for subsequent assertions. +1 relative value,
// Avoid race condition between two calls causing assertion failure./Fake pass.
async function settle(services, calls) {
  const { host, root } = await mountHome(services);
  await waitFor(() => calls.fetchGlossaries.length >= 1, "workflow Initial glossary load stable on domain startup.");
  await wait(30);
  return { host, root, glossariesBaseline: calls.fetchGlossaries.length };
}

async function openGlossariesDialog() {
// Phase C(shadcn refactor): Replace SettingsHubDialog/GlossariesDialog with Radix Dialog
  // Incomplete. Provide full source text. forceMount Content,Unmount entire content in closed state.(No longer native
// <dialog>.open boolean property),here change to use "is mounted" to determine open state.
  click(byId("app-settings-btn"));
await waitFor(() => byId("app-settings-dialog") !== null, "Settings dialog open");
  click(dom.window.document.querySelector('[data-settings-tab="glossary"]'));
  await wait(0);
  click(byId("glossary-btn"));
  await waitFor(() => byId("glossary-manager-dialog") !== null, "Glossary Dialog Open");
}

test("GlossariesDialog: Contract idRefresh on open, Selected state, Editor backfill(preserve term translation left empty)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();

  for (const id of [
    "glossary-close-btn", "glossary-new-btn", "glossary-list", "glossary-list-empty",
    "glossary-name", "glossary-add-row-btn", "glossary-import-btn", "glossary-export-btn",
    "glossary-delete-btn", "glossary-entries", "glossary-entries-empty", "glossary-import-panel",
    "glossary-csv-text", "glossary-import-apply-btn", "glossary-import-cancel-btn",
    "glossary-status", "glossary-save-btn",
  ]) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }

  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Open dialog loads list once.");
await waitFor(() => byId("glossary-name").value === "Quantum Chemistry Terms", "Auto-select first and backfill editor.");
  assert.equal(calls.fetchGlossary.length, 1, "Auto-select triggers detail load once.");

  const listButtons = byId("glossary-list").querySelectorAll("button");
  assert.equal(listButtons.length, 1);
  assert.equal(listButtons[0].classList.contains("is-active"), true, "document.querySelector('input').focus() → skipped: event listener for selection, add when dynamic selection needed.");

// preserve entry(Hartree-Fock)Translation input box must remain "blank" (Not auto-populated.
// source),Backfill semantics apply only during the read phase at save time.ââSee glossaries-store.js header comments
// readEditorPayloadFromDraft,copied from src/js/features/glossaries/view.js:165.
  const sourceInputs = byId("glossary-entries").querySelectorAll(".glossary-entry-source");
  const targetInputs = byId("glossary-entries").querySelectorAll(".glossary-entry-target");
  assert.equal(sourceInputs[0].value, "Hartree-Fock");
  assert.equal(targetInputs[0].value, "", "preserve Entry translation display blank.,No pre-fill. source");
assert.equal(targetInputs[1].value, "Density Functional Theory");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: New draft + preserve On save source Backfill empty translations.(Risk 1 Semantics)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Opening dialog triggers list load once");

  click(byId("glossary-new-btn"));
await waitFor(() => byId("glossary-name").value === "Untitled Glossary", "Auto-fill default name on new draft");

  const sourceInput = byId("glossary-entries").querySelector(".glossary-entry-source");
  assert.ok(sourceInput, "New draft auto-adds one blank entry.");
  typeInput(sourceInput, "Hartree-Fock");
  // level is already by default preserve,No switch needed. select。

  click(byId("glossary-save-btn"));
  await waitFor(() => calls.createGlossary.length === 1, "Save Trigger createGlossary");
  assert.deepEqual(calls.createGlossary[0].entries, [{
    source: "Hartree-Fock",
    target: "Hartree-Fock",
    level: "preserve",
    match_mode: "case_insensitive",
    context: "",
    note: "",
}], "preserve When translation entry is left blank,On save source backfill(Copied from view.js:165)");

  await waitFor(() => calls.refreshWorkflowGlossaries.length === 1, "Post-save callback workflow Domain refresh");
  assert.equal(calls.refreshWorkflowGlossaries[0].force, true);

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Non- preserve save is blocked when term entry lacks translation(Validation)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Opening dialog triggers list load once");

  click(byId("glossary-new-btn"));
await waitFor(() => byId("glossary-name").value === "Untitled Glossary", "New Draft");

  const sourceInput = byId("glossary-entries").querySelector(".glossary-entry-source");
  const levelSelect = byId("glossary-entries").querySelector(".glossary-entry-level");
  typeInput(sourceInput, "density functional theory");
  selectOption(levelSelect, "canonical");
// Translation(target)Keep blank.

  click(byId("glossary-save-btn"));
await waitFor(() => byId("glossary-status").textContent === "Fixed/Preferred translations require a translation.", "Validation Blocked");
  assert.equal(byId("glossary-status").classList.contains("is-error"), true);
  assert.equal(calls.createGlossary.length, 0, "If validation fails, do not call save API.");

  const targetInput = byId("glossary-entries").querySelector(".glossary-entry-target");
typeInput(targetInput, "Density Functional Theory");
  click(byId("glossary-save-btn"));
  await waitFor(() => calls.createGlossary.length === 1, "Translation completed and saved.");
assert.equal(calls.createGlossary[0].entries[0].target, "Density Functional Theory");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：CSV Import and parse to replace draft entries", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Opening dialog triggers list load once");
await waitFor(() => byId("glossary-name").value === "Quantum Chemistry Terms", "Auto-select first item");

  click(byId("glossary-import-btn"));
  await waitFor(() => byId("glossary-import-panel").classList.contains("hidden") === false, "Open Import Panel");

typeInput(byId("glossary-csv-text"), "parsed-term,Parsed Term,canonical,case_insensitive,");
  click(byId("glossary-import-apply-btn"));

await waitFor(() => calls.parseGlossaryCsv.length === 1, "Trigger CSV parsing");
  await waitFor(() => byId("glossary-import-panel").classList.contains("hidden") === true, "Import panel collapses on successful parsing.");
  await waitFor(() => byId("glossary-entries").querySelectorAll(".glossary-entry-row").length === 1, "Replace entry with parsed result.");
  assert.equal(byId("glossary-entries").querySelector(".glossary-entry-source").value, "parsed-term");
  assert.equal(byId("glossary-csv-text").value, "", "Clear after successful parsing CSV Text box");
assert.match(byId("glossary-status").textContent, /Parsed 1 item/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：CSV Export Call exportGlossaryCsv Success", async () => {
  const previousURL = globalThis.URL;
  globalThis.URL = class extends previousURL {
    static createObjectURL() { return "blob:mock-glossary-export"; }
    static revokeObjectURL() {}
  };

  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Opening dialog triggers list load once");
await waitFor(() => byId("glossary-name").value === "Quantum Chemistry Terms", "Auto-select first item");

  click(byId("glossary-export-btn"));
  await waitFor(() => calls.exportGlossaryCsv.length === 1, "Trigger export request");
  assert.equal(calls.exportGlossaryCsv[0], "g-1");
await waitFor(() => /^Exported g-1\.csv\./.test(byId("glossary-status").textContent), "Export successful");
  assert.equal(byId("glossary-status").classList.contains("is-valid"), true);

  root.unmount();
  services.dispose();
  host.remove();
  globalThis.URL = previousURL;
});

test("GlossariesDialog：APP_EVENTS.refreshGlossaries Trigger list reload", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Opening dialog triggers list load once");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.refreshGlossaries));
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 2, "refreshGlossaries Event-triggered reload");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog: Delete current glossary callback workflow Refresh Domain", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "Opening dialog triggers list load once");
await waitFor(() => byId("glossary-name").value === "Quantum Chemistry Terms", "Auto-select first item");

  click(byId("glossary-delete-btn"));
  await waitFor(() => calls.deleteGlossary.length === 1, "Trigger delete request");
  assert.equal(calls.deleteGlossary[0], "g-1");
await waitFor(() => calls.refreshWorkflowGlossaries.some((options) => options.selectedId === ""), "Post-deletion callback workflow domain refresh(selectedId Clear)");

  root.unmount();
  services.dispose();
  host.remove();
});
