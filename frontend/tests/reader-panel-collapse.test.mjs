import test from "node:test";
import assert from "node:assert/strict";
import {
  loadCollapseState,
  saveCollapseState,
  createReaderPanelCollapse,
} from "../src/js/reader/panel-collapse.js";

function memoryStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

function fakeClassList() {
  const set = new Set();
  return {
    _set: set,
    toggle: (name, on) => { if (on) set.add(name); else set.delete(name); },
    has: (name) => set.has(name),
  };
}

function fakeButton() {
  return {
    attrs: {},
    listeners: {},
    classList: fakeClassList(),
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, fn) { this.listeners[t] = fn; },
  };
}

function harness(seed) {
  const body = { classList: fakeClassList() };
  const left = fakeButton();
  const right = fakeButton();
  const documentRef = {
    body,
    getElementById: (id) => (id === "reader-left-collapse-btn" ? left : id === "reader-right-collapse-btn" ? right : null),
  };
  const storage = memoryStorage(seed);
  const collapse = createReaderPanelCollapse({ documentRef, storage });
  return { body, left, right, storage, collapse };
}

test("Persistence: save/load round trip, dirty data and no storage fallback", () => {
  const storage = memoryStorage();
  saveCollapseState({ left: true, right: false }, storage);
  assert.deepEqual(loadCollapseState(storage), { left: true, right: false });
  assert.deepEqual(loadCollapseState(null), { left: false, right: false });
  const bad = memoryStorage({ "retainpdf-reader-collapse-v1": "{oops" });
  assert.deepEqual(loadCollapseState(bad), { left: false, right: false });
});

test("toggleLeft/toggleRight toggle body collapse class and persist", () => {
  const { body, left, storage, collapse } = harness();
  collapse.bindEvents();
  assert.equal(body.classList.has("reader-left-collapsed"), false);

  collapse.toggleLeft();
  assert.equal(body.classList.has("reader-left-collapsed"), true);
  assert.equal(left.classList.has("is-collapsed"), true);
  assert.equal(left.attrs["aria-expanded"], "false");
  assert.deepEqual(loadCollapseState(storage), { left: true, right: false });

  collapse.toggleLeft();
  assert.equal(body.classList.has("reader-left-collapsed"), false);
  assert.equal(left.attrs["aria-expanded"], "true");
});

test("expandRight only takes effect when right column is collapsed (opening tool in topbar automatically reveals)", () => {
  const { body, collapse } = harness({ "retainpdf-reader-collapse-v1": JSON.stringify({ left: false, right: true }) });
  collapse.bindEvents();
  assert.equal(body.classList.has("reader-right-collapsed"), true);

  collapse.expandRight();
  assert.equal(body.classList.has("reader-right-collapsed"), false);
// Calling again when already expanded is idempotent, no error
  assert.doesNotThrow(() => collapse.expandRight());
  assert.equal(collapse.state().right, false);
});

test("bindEvents restores persisted collapse state and binds click to handles", () => {
  const { body, left, right, collapse } = harness({ "retainpdf-reader-collapse-v1": JSON.stringify({ left: true, right: true }) });
  collapse.bindEvents();
  assert.equal(body.classList.has("reader-left-collapsed"), true);
  assert.equal(body.classList.has("reader-right-collapsed"), true);
  assert.equal(typeof left.listeners.click, "function");
  assert.equal(typeof right.listeners.click, "function");
});
