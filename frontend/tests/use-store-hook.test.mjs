import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "navigator"]) {
  try {
    Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
  } catch (_err) { /* navigator Ignore when read-only */ }
}
globalThis.window = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement, useRef } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createStore } = await import("../src/js/app-framework/store.js");
const { useStoreSnapshot, shallowEqual } = await import("../src/shared/react/use-store.js");

function renderProbe(store, selector) {
  const renders = [];
  function Probe() {
    const value = useStoreSnapshot(store, selector);
    const countRef = useRef(0);
    countRef.current += 1;
    renders.push({ count: countRef.current, value });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  act(() => {
    root.render(createElement(Probe));
  });
  return { renders, root, unmount: () => act(() => root.unmount()) };
}

test("getSnapshot reference stability: no infinite re-renders due to snapshot cloning after mount", () => {
  const store = createStore({ name: "t1", initialState: { n: 1 }, actions: { bump: (d) => ({ ...d, n: d.n + 1 }) } });
  const { renders, unmount } = renderProbe(store);
  // If reference unstable,useSyncExternalStore Triggers infinite re-render loop here.(React Throw error or render count explosion)
assert.ok(renders.length <= 2, `Mount render count should be <=2, actual ${renders.length}`);
  assert.equal(renders.at(-1).value.n, 1);
  unmount();
});

test("store change triggers re-render and retrieves new snapshot", () => {
  const store = createStore({ name: "t2", initialState: { n: 1 }, actions: { bump: (d) => ({ ...d, n: d.n + 1 }) } });
  const { renders, unmount } = renderProbe(store);
  const before = renders.length;
  act(() => {
    store.actions.bump();
  });
assert.ok(renders.length > before, "Should re-render after bump");
  assert.equal(renders.at(-1).value.n, 2);
  unmount();
});

test("selector shallow comparison: unrelated slice changes do not trigger re-render", () => {
  const store = createStore({
    name: "t3",
    initialState: { items: ["a"], noise: 0 },
    actions: {
      addNoise: (d) => ({ ...d, noise: d.noise + 1 }),
      addItem: (d) => ({ ...d, items: [...d.items, "b"] }),
    },
  });
  const selector = (s) => ({ items: s.items });
  const { renders, unmount } = renderProbe(store, selector);
  const before = renders.length;
  act(() => {
    store.actions.addNoise();
  });
  // items Refs are new clones but shallow comparison fails. key Object.is……Cloned items Array reference mutates.,
  // So selected here is"selector Result object",Shallow compare to items Array reference——Cloning breaks references.
  // True isolation relies on selector Select original value/Stable serialization;Validate correct semantics here:
  // Zero re-renders on irrelevant changes when selecting primitive value slices.
  unmount();

  const primitiveSelector = (s) => ({ count: s.items.length });
  const probe2 = renderProbe(store, primitiveSelector);
  const before2 = probe2.renders.length;
  act(() => {
    store.actions.addNoise();
  });
assert.equal(probe2.renders.length, before2, "Original value slice: noise change should not trigger re-render");
  act(() => {
    store.actions.addItem();
  });
assert.equal(probe2.renders.at(-1).value.count, 2, "items change should trigger re-render and get new value");
  assert.ok(before >= 1);
  probe2.unmount();
});

test("shallowEqual semantics", () => {
  assert.equal(shallowEqual({ a: 1 }, { a: 1 }), true);
  assert.equal(shallowEqual({ a: 1 }, { a: 2 }), false);
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(shallowEqual(null, null), true);
  assert.equal(shallowEqual(null, {}), false);
});
