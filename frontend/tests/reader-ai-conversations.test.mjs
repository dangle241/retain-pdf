import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Multi-session conversation management (React component version): replaces the old DOM controller driving src/js/reader/ai/chat.js,
// Since Phase 2b, AI Q&A UI migrated to React (src/pages/reader/legacy/components/ReaderAiChat.jsx).
// Assertion semantics consistent with old version: bubble class name (.reader-ai-message-body-el), session dropdown options,
// historyStore session count. Also incorporate two chat semantics from old reader.test.mjs:
// submit status flow, 502 fallback to local search.
//
// Driving approach: first mount uses real DOM events (form submit/button click, test React wiring);
// subsequent tests call orchestration handlers directly via controllerRef (equivalent to old test calling chat.submit()) —
// under node:test environment, after remounting component with new key, React root event delegation stalls (environment issue, not in browser),
// component rendering and flushSync are unaffected, assertions still all hit the real DOM.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
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
const { ReaderAiChat } = await import("../src/pages/reader/legacy/components/ReaderAiChat.jsx");
const { createReaderAiHistoryStore } = await import("../src/js/reader/ai/chat-history-store.js");

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

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
  };
}

// Single root reused across file: under node:test, a second createRoot created inside a test
// will not be flushed by scheduler (same pit as reader-drawers.test.mjs), so we remount component with new key instead.
const documentRef = dom.window.document;
const chatHost = documentRef.createElement("div");
documentRef.body.appendChild(chatHost);
const chatRoot = createRoot(chatHost);
let mountSeq = 0;

async function makeChat({ answer, remoteAnswerer = null, fallbackAnswerer = null } = {}) {
  const historyStore = createReaderAiHistoryStore({ jobId: "job-conv", storage: memoryStorage() });
  const controllerRef = { current: null };
  mountSeq += 1;
  chatRoot.render(React.createElement(ReaderAiChat, {
    key: `chat-${mountSeq}`,
    controllerRef,
    ports: {
      jobId: "job-conv",
      historyStore,
      fallbackAnswerer,
      remoteAnswerer: remoteAnswerer || {
        ensureLoaded: async () => true,
answer: answer || (async ({ question }) => ({ answer: Answer: {question}`, citations: [], scope: "document" })),
      },
    },
  }));
// Wait for mount + startup flow (restore→prepare) to finish
  await waitFor(
() => controllerRef.current && !statusText().includes("in progress"),
"chat mounted and ready",
  );
  return { controller: () => controllerRef.current, historyStore };
}

const bubbleTexts = () =>
  [...documentRef.querySelectorAll(".reader-ai-message .reader-ai-message-body-el")].map((el) => el.textContent);
const selectOptions = () =>
  [...documentRef.getElementById("reader-ai-session-select").options].map((o) => o.textContent);
const statusText = () => documentRef.getElementById("reader-ai-status")?.textContent || "";

test("DOM Wiring:Form submission generates Q&A bubbles.,Clear threads.", async () => {
  const { historyStore } = await makeChat();
// First mount: React root event delegation available, use real DOM events to test wiring
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
setter.call(input, "Session A question");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(
() => bubbleTexts().some((t) => t.includes("Answer: Session A question")),
    "DOM Submit Generated Response",
  );
assert.ok(bubbleTexts().some((t) => t.includes("Session A question")));

  documentRef.getElementById("reader-ai-new-btn")
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => bubbleTexts().length === 0, "new conversation thread is empty");
  assert.equal(historyStore.listSessions().length, 2);
});

test("Switch Session:Reload target conversation bubbles.", async () => {
  const { controller, historyStore } = await makeChat();
await controller().submit("First question");
  const idA = historyStore.activeSessionId();
assert.ok(idA, "Should have active session after first submission.");

  await controller().newConversation();
assert.equal(bubbleTexts().length, 0, "New conversation thread is empty");
await controller().submit("Second question");
assert.ok(bubbleTexts().some((t) => t.includes("Second question")));
assert.ok(!bubbleTexts().some((t) => t.includes("First question")));

  await controller().switchConversation(idA);
assert.ok(bubbleTexts().some((t) => t.includes("First question")), "Switch back A bubble restored");
assert.ok(!bubbleTexts().some((t) => t.includes("Second question")));
});

test("Delete current conversation:Remove & switch to remaining session", async () => {
  const { controller, historyStore } = await makeChat();
await controller().submit("Retained question");
  await controller().newConversation();
await controller().submit("Question to delete");
  assert.equal(historyStore.listSessions().length, 2);

  await controller().deleteConversation();
  assert.equal(historyStore.listSessions().length, 1);
assert.ok(bubbleTexts().some((t) => t.includes("Retained question")), "After deletion, falls to retained session.");
});

test("Session Switcher:Submit: dropdown with titled options.", async () => {
  const { controller } = await makeChat();
await controller().submit("Question for naming the session");
  await waitFor(
() => selectOptions().some((t) => t.includes("Question for naming the session")),
    "Session title appears on dropdown",
  );
});

test("Submit status flow: after completion, status is 'Ready to ask more', input cleared", async () => {
  const { controller } = await makeChat();
await controller().submit("Status flow question");
await waitFor(() => statusText() === "Ready to ask more", "Final status settled");
  assert.equal(documentRef.getElementById("reader-ai-input").value, "");
  const texts = bubbleTexts();
  assert.equal(texts.length, 2);
assert.equal(texts[0], "Status flow question");
assert.equal(texts[1], "Answer: Status flow question");
});

test("Fallback to local search on backend 502: status and bubble annotation", async () => {
  const { controller } = await makeChat({
    fallbackAnswerer: {
      ensureLoaded: async () => true,
      answer: async () => ({
        answer: "Local fallback",
        citations: [{ title: "Fallback", page: 2, snippet: "local snippet" }],
      }),
    },
    remoteAnswerer: {
      ensureLoaded: async () => true,
      answer: async () => {
        throw new Error("502 provider failed");
      },
    },
  });
  await controller().submit("Explain fallback");

await waitFor(() => statusText() === "Answered using local search", "Fallback status settled");
  const assistantText = bubbleTexts().at(-1);
  assert.match(assistantText, /Local fallback/);
assert.match(assistantText, /citation/);
  assert.match(assistantText, /502 provider failed/);
});
