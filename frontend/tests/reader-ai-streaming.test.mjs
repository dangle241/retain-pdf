import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Streaming render intermediate state (React component version): old version drove chat.js, after Phase 2b migrated to React
// Change to render ReaderAiChat and DOM submission drive; assert semantics unchanged. — onAnswerDelta on arrival
// Bubble should appear "Only first few paragraphs" intermediate render state (proves streaming rendering, instead of rendering all at once at the end).

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
assert.fail(`Timeout waiting for: {description});
}

test("Streaming: bubble updates incrementally when onAnswerDelta arrives (intermediate text exists before finalize)", async () => {
  const documentRef = dom.window.document;
  const bodyText = () => documentRef.querySelector(".reader-ai-message-assistant .reader-ai-message-body-el")?.textContent || "";
  const snapshots = [];
  const host = documentRef.createElement("div");
  documentRef.body.appendChild(host);
  createRoot(host).render(React.createElement(ReaderAiChat, {
    ports: {
      jobId: "job-stream",
      historyStore: { load: () => ({ messages: [], history: [] }), save() {}, clear() {} },
      remoteAnswerer: {
        ensureLoaded: async () => true,
// paced: push deltas in frames, leave interval > throttle (90ms) between frames to allow intermediate rendering to trigger
        answer: async ({ onAnswerDelta }) => {
for (const chunk of ["First paragraph.", "Second paragraph.", "Third paragraph."]) {
            onAnswerDelta?.((snapshots.at(-1)?.acc || "") + chunk, chunk);
            snapshots.push({ acc: (snapshots.at(-1)?.acc || "") + chunk });
            await wait(130);
            snapshots.push({ mid: bodyText() });
          }
          return { answer: "第一段。第二段。第三段。", citations: [], scope: "document" };
        },
      },
    },
  }));

// Submit after component mount + restore/prepare ready
await waitFor(() => documentRef.getElementById("reader-ai-input"), "composer mounted");
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
setter.call(input, "Test streaming");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

await waitFor(() => /First paragraph. Second paragraph. Third paragraph./.test(bodyText()), "final state complete");
  await wait(50);

// Intermediate snapshots should contain a state with "only the first few paragraphs, not all" (proves streaming rendering, not just at the end)
  const midTexts = snapshots.filter((s) => "mid" in s).map((s) => s.mid);
assert.ok(midTexts.some((t) => t.includes("First paragraph") && !t.includes("Third paragraph")),
Intermediate render state should exist, actual: {JSON.stringify(midTexts)}`);
// Final state complete
assert.match(bodyText(), /First paragraph. Second paragraph. Third paragraph./);
});
