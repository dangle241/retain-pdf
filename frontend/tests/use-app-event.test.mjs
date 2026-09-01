import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// useAppEvent(APP_EVENTS â React adapter hook) unit tests:
// Subscription lifecycle,handler ref Update: no resubscribe. Uninstall: unbind. Custom. target。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (introduced in Phase B) requires cancelAnimationFrame under jsdom
// (TabsContent mount animation timer cleanup) and getComputedStyle (Presence reads
// animation-name to determine if exit animation ended)âimplemented on jsdom window, but not
// copied to bare global like requestAnimationFrame; adding it here.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { useAppEvent } = await import("../src/shared/react/use-app-event.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(10);
  }
assert.fail(`Wait timeout: ${description}`);
}

function Probe({ eventName, handler, target }) {
  useAppEvent(eventName, handler, { target });
  return null;
}

test("useAppEvent: subscribe to document events and unbind on unmount", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const calls = [];
  const root = createRoot(host);

  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:ping",
    handler: (event) => calls.push(event.detail),
  }));
  await waitFor(() => {
    dom.window.document.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:ping", { detail: "a" }));
    return calls.length > 0;
}, "First event delivered");
  assert.equal(calls[calls.length - 1], "a");

  const seen = calls.length;
  root.unmount();
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:ping", { detail: "b" }));
  await wait(20);
assert.equal(calls.length, seen, "Should not receive events after unmount");
  host.remove();
});

test("useAppEvent: handler reference drift does not resubscribe, always calls latest handler", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  const doc = dom.window.document;
  const originalAdd = doc.addEventListener.bind(doc);
  let addCount = 0;
  doc.addEventListener = (name, listener, options) => {
    if (name === "retainpdf-test:swap") {
      addCount += 1;
    }
    return originalAdd(name, listener, options);
  };

  const calls = [];
  const root = createRoot(host);
  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:swap",
    handler: () => calls.push("first"),
  }));
  await waitFor(() => {
    doc.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:swap"));
    return calls.length > 0;
}, "Initial handler effective");
  assert.equal(calls[calls.length - 1], "first");

// Re-render with new handler (New reference): Must not repeat addEventListener
  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:swap",
    handler: () => calls.push("second"),
  }));
  await waitFor(() => {
    doc.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:swap"));
    return calls[calls.length - 1] === "second";
}, "New handler effective");
assert.equal(addCount, 1, "Handler reference change should not rebuild subscription");

  doc.addEventListener = originalAdd;
  root.unmount();
  host.remove();
});

test("useAppEvent: supports custom target", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const target = dom.window.document.createElement("section");
  const calls = [];
  const root = createRoot(host);
  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:scoped",
    handler: () => calls.push(1),
    target,
  }));
  await waitFor(() => {
    target.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:scoped"));
    return calls.length > 0;
}, "Target event delivered");

  const seen = calls.length;
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:scoped"));
  await wait(20);
assert.equal(calls.length, seen, "Same-name events on document should not trigger target subscription");

  root.unmount();
  host.remove();
});
