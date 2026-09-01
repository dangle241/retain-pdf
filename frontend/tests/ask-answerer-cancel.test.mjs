import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Cancel semantic lock (audit P0-2/P0-4 regression lock, ask-answerer Right):
// 1. answer() passes AbortSignal to ask (askLibraryAi â fetch) ââ Stream interruption confirmed.
// 2. aborted Return old stream. conversation_id,Disable session affinity write-back.
//    Otherwise "switching session during generation" overwritten by old done. Restore old session, next question dispatched to wrong thread.

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { createReaderAskAnswerer } = await import("../src/js/reader/ai/ask-answerer.ts");
const { loadStoredConversationId } = await import("../src/js/reader/ai/conversation-store.ts");

function makeAnswerer(fakeAsk, jobId) {
  return createReaderAskAnswerer({
    jobId,
    ask: fakeAsk,
    documentByJobId: async () => ({ document_id: `doc-${jobId}` }),
    llmConfig: () => ({ apiKey: "test-model-key" }),
  });
}

test("signal passed to ask, write back session affinity on normal completion", async () => {
  const seen = {};
  const answerer = makeAnswerer(async (args) => {
    seen.signal = args.signal;
    return { answer: "答 [1]", citations: [], conversationId: "conv-live" };
  }, "job-cancel-a");

  const controller = new AbortController();
  const result = await answerer.answer({ question: "问", signal: controller.signal });
assert.equal(seen.signal, controller.signal, "signal must be passed to ask");
  assert.equal(result.conversationId, "conv-live");
assert.equal(answerer.getConversationId(), "conv-live", "Normal completion writes back memory affinity");
  assert.equal(
    loadStoredConversationId({ jobId: "job-cancel-a" }),
    "conv-live",
"Normal completion writes back storage affinity",
  );
});

test("aborted old stream forbidden from writing back session affinity (P0-4)", async () => {
  const answerer = makeAnswerer(async () => {
// Simulate: abort occurs during stream processing, but done restores old session id
    return { answer: "迟到的旧答案", citations: [], conversationId: "conv-stale" };
  }, "job-cancel-b");

  const controller = new AbortController();
  controller.abort();
  await answerer.answer({ question: "问", signal: controller.signal });
assert.notEqual(answerer.getConversationId(), "conv-stale", "aborted must not change memory affinity");
  assert.notEqual(
    loadStoredConversationId({ jobId: "job-cancel-b" }),
    "conv-stale",
"aborted must not write storage affinity",
  );
});
