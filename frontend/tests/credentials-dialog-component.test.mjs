import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// CredentialsDialog (Phase 3 dialogs group, Blueprint Â§2) component test.
// Verify: contract id, openBrowserCredentials Event open (including setupMode first-run setup state),
// OCR/DeepSeek Validate tri-state; save two branches (browser/desktop). Hide input and
// credentialsStatePort two-way sync. SettingsHubDialog #credentials-btn trigger points,
// Glossary/Update two tabs placeholder id contract.

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
// animation-name to determine if exit animation ended) ââ implemented on jsdom window, but not
// copied to bare global like requestAnimationFrame; adding it here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");
const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");
const { defaultCredentialsStatePort } = await import("../src/js/features/credentials/default-state-port.js");

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
assert.fail(`Timeout waiting for: ${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
// Radix Tabs Trigger activation logic is on onMouseDown (not onClick) ââ Phase B
// After migrating to Radix Tabs (CredentialsDialog/SettingsHubDialog tabs), only
// dispatching "click" does not trigger tab switching. Real browser clicks are
// a full mousedownâmouseupâclick sequence; adding mousedown to make simulated click more realistic
// interaction, rather than relaxing any assertions.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function mockValidators(overrides = {}) {
  return {
    validateOcrToken: async (_apiPrefix, _providerId, token) => {
      if (!token) {
        return { ok: false, status: "unauthorized", summary: "缺少 token" };
      }
      if (token === "bad-token") {
        return { ok: false, status: "unauthorized", summary: "Token Invalid" };
      }
      return { ok: true, status: "valid", summary: "Token Valid" };
    },
    validateDeepSeekToken: async (_apiPrefix, payload) => {
      if (!payload?.api_key) {
        return { ok: false, status: 0 };
      }
      if (payload.api_key === "bad-key") {
        return { ok: false, status: 401, summary: "DeepSeek Key Invalid or expired." };
      }
      return { ok: true, status: 200, summary: "DeepSeek Connected." };
    },
    queryDeepSeekBalance: async () => ({
      ok: true,
      is_available: true,
      balance_infos: [{ currency: "CNY", total_balance: "88.00" }],
    }),
    ...overrides,
  };
}

function createServices(overrides = {}) {
  const { validateOcrToken, validateDeepSeekToken, queryDeepSeekBalance, ...rest } = mockValidators(overrides.validators);
  return createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    validateOcrToken,
    validateDeepSeekToken,
    queryDeepSeekBalance,
    ...rest,
    ...overrides,
  });
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
await waitFor(() => byId("app-shell"), "HomeApp first frame rendered");
  await wait(0);
  return { host, root };
}

test("CredentialsDialog: Normal entry goes through Settings API; setupMode still opens the independent first-time configuration dialog API；setupMode Keep first-time setup independent", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

// Phase C (shadcn refactor): CredentialsDialog no longer forceMounts after switching to Radix Dialog
  // Content——Entire content on dialog close(Contains following contracts id)Do not mount.
  assert.equal(byId("browser-credentials-dialog"), null, "Skip mount if initially closed.");

// Regular: openBrowserCredentials â Settings Center API District (sole daily entry)
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "Open Settings Center");
  await waitFor(() => byId("browser-api-key") !== null, "API In-Area Embedded Workbench");
assert.equal(byId("browser-credentials-dialog"), null, "No longer pops independent interface settings window");
  assert.ok(byId("browser-credentials-save-btn"), "Embedded workspace saved.");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-settings-dialog") === null, "Close Settings");

// ---- setupMode first-time config: Standalone modal tabs hidden, title/Save copy toggle ----
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId("browser-credentials-dialog") !== null, "setupMode Open Standalone Popup");
await waitFor(() => byId("browser-credentials-title")?.textContent === "First-time Configuration", "setupMode Toggle Title");

  for (const id of [
    "browser-credentials-title", "browser-credentials-close-btn", "browser-credentials-status",
    "browser-credentials-tabs", "browser-credential-tab-api", "browser-credential-tab-task",
    "browser-credentials-save-btn", "browser-paddle-token", "browser-paddle-validate-btn",
    "browser-paddle-validation", "browser-api-key", "browser-deepseek-validate-btn",
    "browser-deepseek-validation", "browser-deepseek-top-up-link", "browser-job-math-mode",
  ]) {
assert.ok(byId(id), `Contract id missing: #${id}`);
  }

assert.equal(byId("browser-credentials-save-btn").textContent, "Save and Start");
  assert.equal(byId("browser-credentials-tabs").classList.contains("hidden"), true);
  assert.equal(byId("browser-credentials-dialog").dataset.setupMode, "1");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Credentials entry: Settings API Inline workbench in zone.#credential-gate-action Also open settings API", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

// Settings â API Zone: CredentialsWorkbench embedded directly. (v2 major refactor, Lobby button
  // #credentials-btn User request retire. Remove code. Test.),Don't show again browser-credentials-dialog。
  click(byId("app-settings-btn"));
await waitFor(() => byId("app-settings-dialog") !== null, "Settings dialog opened");
await waitFor(() => byId("browser-credentials-tabs") !== null, "Credentials workbench embedded in API zone (tabs mounted)");
  assert.ok(byId("browser-credentials-save-btn"), "Embedded workbench with Save button.");
  assert.equal(byId("credentials-btn"), null, "Lobby button retired");
  assert.equal(byId("browser-credentials-dialog"), null, "no longer pop up second-layer credential dialog in settings");

  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-settings-dialog") === null, "Close Settings");

// Phase C (shadcn refactor): credential-gate-action is attached to TranslationWorkflowDialog
// Inside (HeroUpload upload guidance area), this dialog no longer forceMounts after switching to Radix Dialog
// Content ââ First open required before mount (following Phase C dialog precedents).
  services.workflowDialog.openUpload();
await waitFor(() => byId("credential-gate-action"), "credential-gate-action mounted after workflow dialog opens");
  click(byId("credential-gate-action"));
  await waitFor(() => byId("app-settings-dialog") !== null, "credential-gate-action Open Settings");
await waitFor(() => byId("browser-api-key") !== null, "Land on API settings workbench");
  assert.equal(byId("browser-credentials-dialog"), null, "Regular access control: no separate pop-up window.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: OCR/DeepSeek Tri-state Validation (Missing/Error/Pass)", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  // Validation uses embedded workbench in settings (consistent with daily entry).
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
  await waitFor(() => byId("app-settings-dialog") !== null, "Open Settings");
  await waitFor(() => byId("browser-paddle-validate-btn") !== null, "API Workspace ready");

// ---- OCR(paddle): Missing â Error â Pass ----
  click(byId("browser-paddle-validate-btn"));
await waitFor(() => byId("browser-paddle-validation").title === "Please fill in the Paddle Access Token first.", "OCR Missing state");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(byId("browser-paddle-token"), "bad-token");
  click(byId("browser-paddle-validate-btn"));
await waitFor(() => byId("browser-paddle-validation").title === "Invalid Token", "OCR error state");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-error"), true);

  typeInput(byId("browser-paddle-token"), "good-token");
  click(byId("browser-paddle-validate-btn"));
await waitFor(() => byId("browser-paddle-validation").title === "Token Valid", "OCR pass state");
  assert.equal(byId("browser-paddle-validation").classList.contains("is-valid"), true);

// ---- DeepSeek: Missing â Error â Pass (Includes recharge prompt, balance < 2 only appears at Yuan time.ââ
//      mock returns 88 Yuan, Hide recharge link.) ----
// Missing state: handleBrowserDeepSeekValidate in deepseek-flow.js(kept) for "Missing
// Key" direct branch return, Skip logo validation. YAGNI. (Differs from OCR Branch semantics, Existing.
  // Business logic,Non-origin rewrite behavior)——Missing state validation triggered by save button guard.
  click(byId("browser-credentials-save-btn"));
await waitFor(() => byId("browser-deepseek-validation").title === "Please fill in the DeepSeek Key first.", "DeepSeek missing state (triggered by save guard)");
  assert.equal(byId("browser-deepseek-validation").classList.contains("is-error"), true);
  assert.notEqual(byId("app-settings-dialog"), null, "Validation failed. Missing fields. Fix: Add field checks before save.,dialog.showModal() → skipped: close event, add when modal needs closing");

  typeInput(byId("browser-api-key"), "bad-key");
  click(byId("browser-deepseek-validate-btn"));
await waitFor(() => byId("browser-deepseek-validation").title === "DeepSeek Key is invalid or expired.", "DeepSeek error state");
  assert.equal(byId("browser-deepseek-validation").classList.contains("is-error"), true);
  assert.equal(byId("browser-deepseek-top-up-link").classList.contains("hidden"), true);

  typeInput(byId("browser-api-key"), "good-key");
  click(byId("browser-deepseek-validate-btn"));
  await waitFor(() => byId("browser-deepseek-validation").classList.contains("is-valid"), "DeepSeek Passed");
assert.match(byId("browser-deepseek-validation").title, /ä½é¢ CNY 88\.00/);
  assert.equal(byId("browser-deepseek-top-up-link").classList.contains("hidden"), true, "No recharge prompt when balance sufficient.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: Save(browser mode)——Write Hidden inputSync credentialsStatePort", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

// Phase C (shadcn refactor): hide inputs like paddle_token/api_key/ocr_provider
// (HiddenCredentialInputs) mounted inside TranslationWorkflowDialog (job-form),
// After switching this dialog to Radix Dialog, Content is not forceMountedâmust open once to
// mount (following precedents of other Phase C dialogs).
  services.workflowDialog.openUpload();
await waitFor(() => byId("paddle_token"), "Hide after workflow dialog opens. input mounted");

// Regular save entry: Settings â API
  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials));
await waitFor(() => byId("app-settings-dialog") !== null, "Open settings");
await waitFor(() => byId("browser-api-key") !== null, "API workbench ready");

  typeInput(byId("browser-paddle-token"), "paddle-secret");
  typeInput(byId("browser-api-key"), "deepseek-secret");

  click(byId("browser-credentials-save-btn"));
  await waitFor(
    () => defaultCredentialsStatePort.getCredentials().modelApiKey === "deepseek-secret",
"After saving. credentialsStatePort updated",
  );

  assert.equal(byId("paddle_token").value, "paddle-secret", "Hide input Bridge:paddle_token");
assert.equal(byId("api_key").value, "deepseek-secret", "Hidden input bridge:api_key");
  assert.equal(byId("ocr_provider").value, "paddle");

  const credentials = defaultCredentialsStatePort.getCredentials();
  assert.equal(credentials.paddleToken, "paddle-secret");
  assert.equal(credentials.modelApiKey, "deepseek-secret");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: Save (Desktop Mode) â use saveDesktopConfig branch", async () => {
  const desktopCalls = [];
  const services = createServices({
    initialDesktopMode: true,
    saveDesktopConfig: async (browserConfig, afterSave) => {
      desktopCalls.push({ browserConfig });
      await afterSave?.();
      return { firstRunCompleted: true };
    },
  });
  const { host, root } = await mountHome(services);

// Phase C (shadcn refactor): saveDesktopConfig branch also reads HiddenCredentialInputs
// Hidden inputs (paddle_token etc.) inside TranslationWorkflowDialog require
// the workflow dialog to be opened once before they are mounted.
  services.workflowDialog.openUpload();
await waitFor(() => byId("paddle_token"), "Hidden input mounted after workflow dialog opens");

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
  await waitFor(() => byId("browser-credentials-dialog") !== null, "Open Dialog(setupMode)");

  typeInput(byId("browser-paddle-token"), "paddle-desktop");
  typeInput(byId("browser-api-key"), "deepseek-desktop");

  click(byId("browser-credentials-save-btn"));
  await waitFor(() => desktopCalls.length === 1, "saveDesktopConfig Called");
  assert.equal(desktopCalls[0].browserConfig.modelApiKey, "deepseek-desktop");
  assert.equal(desktopCalls[0].browserConfig.paddleToken, "paddle-desktop");
  assert.equal(desktopCalls[0].browserConfig.markConfigured, true, "setupMode Mark first configuration complete");
  await waitFor(() => byId("browser-credentials-dialog") === null, "Dialog closes after successful save.");

  root.unmount();
  services.dispose();
  host.remove();
});

test("CredentialsDialog: Hidden input and credentialsStatePort One-way controlled sync (Blueprint Risk 1)", async () => {
// Implementation adjustment (see HiddenCredentialInputs.jsx header): hidden inputs now use
// controlled rendering (value directly subscribes to credentialsStatePort.store), not the blueprint's original
// "uncontrolled ref + mirrorCredentialsToHiddenInputs bidirectional sync" â testing proved that
// combination is silently cleared by React's form element controlled-state recovery logic whenever any sibling component re-renders
// (HeroUpload re-renders frequently during upload, wiping out recently saved tokens). Controlled is the only
// way to prevent React from eating the values. Store is the single source of truth, DOM is a pure projection, so we only
// assert "store â hidden input" one-way sync, and confirm "direct DOM modification" is not adopted
// (proving the truth is indeed the store, not a bypassable DOM).
  const services = createServices();
  const { host, root } = await mountHome(services);

// Phase C (shadcn refactor): hidden inputs are inside TranslationWorkflowDialog
// (job-form). After switching to Radix Dialog without forceMount Content, it requires
// opening once to mount (consistent with other Phase C dialogs).
  services.workflowDialog.openUpload();
await waitFor(() => byId("paddle_token"), "Hidden input mounted after workflow dialog opens");

// credentialsStatePort already wrote persistent config during composition initialization;
// HiddenCredentialInputs should project current store state into hidden inputs in real-time.
  defaultCredentialsStatePort.setCredentials({
    ocrProvider: "paddle",
    paddleToken: "from-store",
    modelApiKey: "from-store-key",
  });
await waitFor(() => byId("paddle_token").value === "from-store", "store â hidden input projection");
  assert.equal(byId("api_key").value, "from-store-key");

// Direct DOM modification (simulating browser autofill or other uncontrolled write paths) bypasses the store,
// and will not be adopted as the "truth" â any subsequent re-render triggered by a credentials change will
// pull the DOM back to the store value, proving the store is the sole truth and eliminating the risk of "silent DOM drift,
// or reading dirty values on form submission" (which is the silent failure Blueprint Risk 1 prevents).
  typeInput(byId("paddle_token"), "from-dom");
assert.equal(byId("paddle_token").value, "from-dom", "Native setter Write itself takes effect.(no onChange interception)");
// Trigger a credentials update (even if content is unchanged) to verify the next render pulls DOM back to store
  defaultCredentialsStatePort.patchCredentials({});
  await waitFor(() => byId("paddle_token").value === "from-store", "after re-render DOM Pulled back store truth value,External write not accepted.");
  assert.equal(defaultCredentialsStatePort.getCredentials().paddleToken, "from-store", "store Unassigned DOM Write Pollution");

  root.unmount();
  services.dispose();
  host.remove();
});

test("SettingsHubDialog: Glossary/Appearance/Update tab contract", async () => {
  const services = createServices();
  const { host, root } = await mountHome(services);

  click(byId("app-settings-btn"));
await waitFor(() => byId("app-settings-dialog") !== null, "Settings dialog opened");

  const glossaryTab = dom.window.document.querySelector('[data-settings-tab="glossary"]');
  click(glossaryTab);
  await waitFor(() => byId("glossary-btn"), "Glossary tab Placeholder button exists.");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="glossary"]').hidden, false);

  const appearanceTab = dom.window.document.querySelector('[data-settings-tab="appearance"]');
assert.ok(appearanceTab, "Appearance tab exists");
  click(appearanceTab);
  await waitFor(() => byId("theme-appearance-panel"), "Mount Appearance Panel");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="appearance"]').hidden, false);
  assert.ok(byId("theme-option-classic"), "Classic Skin");
  assert.ok(byId("theme-option-jiangnan"), "Jiangnan Courtyard");
  assert.ok(byId("theme-option-seacliff"), "Cape Options");
  assert.ok(byId("theme-option-night"), "Dark Tile Night Option");

// Switching skin should write to data-theme
  click(byId("theme-option-jiangnan"));
  await waitFor(
    () => dom.window.document.documentElement.dataset.theme === "jiangnan",
    "After selecting Jiangnan Courtyard html[data-theme=jiangnan]",
  );
  click(byId("theme-option-night"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "night"
      && dom.window.document.documentElement.classList.contains("theme-dark"),
"Daiwa Night + theme-dark class",
  );
  click(byId("theme-option-classic"));
  await waitFor(
    () =>
      dom.window.document.documentElement.dataset.theme === "classic"
      && !dom.window.document.documentElement.classList.contains("theme-dark"),
    "Switch back to classic and remove. theme-dark",
  );

  const updateTab = dom.window.document.querySelector('[data-settings-tab="update"]');
  click(updateTab);
await waitFor(() => byId("app-update-btn"), "Update tab placeholder button exists");
  assert.equal(dom.window.document.querySelector('[data-settings-panel="update"]').hidden, false);

  root.unmount();
  services.dispose();
  host.remove();
});
