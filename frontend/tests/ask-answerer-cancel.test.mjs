import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Khóa ngữ nghĩa hủy (khóa hồi quy audit P0-2/P0-4, phía ask-answerer):
// 1. answer() chuyển tiếp AbortSignal cho ask (askLibraryAi → fetch) — ngắt stream là thật
// 2. Stream đã hủy dù mang conversation_id về cũng cấm ghi lại session keo dính
//    (nếu không "đổi session khi đang sinh" sẽ bị done cũ kéo về session cũ, câu hỏi sau lọt nhầm thread)

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

test("signal truyền đến ask, khi hoàn thành bình thường thì ghi lại session keo dính", async () => {
  const seen = {};
  const answerer = makeAnswerer(async (args) => {
    seen.signal = args.signal;
    return { answer: "Trả lời [1]", citations: [], conversationId: "conv-live" };
  }, "job-cancel-a");

  const controller = new AbortController();
  const result = await answerer.answer({ question: "Câu hỏi", signal: controller.signal });
  assert.equal(seen.signal, controller.signal, "signal phải được truyền đến ask");
  assert.equal(result.conversationId, "conv-live");
  assert.equal(answerer.getConversationId(), "conv-live", "Hoàn thành bình thường ghi lại session keo dính trong bộ nhớ");
  assert.equal(
    loadStoredConversationId({ jobId: "job-cancel-a" }),
    "conv-live",
    "Hoàn thành bình thường ghi lại session keo dính trong storage",
  );
});

test("Luồng cũ bị aborted cấm ghi lại session keo dính (P0-4)", async () => {
  const answerer = makeAnswerer(async () => {
    // Giả lập: abort xảy ra khi stream đang chạy, nhưng done vẫn mang session ID cũ
    return { answer: "Câu trả lời cũ muộn", citations: [], conversationId: "conv-stale" };
  }, "job-cancel-b");

  const controller = new AbortController();
  controller.abort();
  await answerer.answer({ question: "Câu hỏi", signal: controller.signal });
  assert.notEqual(answerer.getConversationId(), "conv-stale", "aborted không được sửa session keo dính trong bộ nhớ");
  assert.notEqual(
    loadStoredConversationId({ jobId: "job-cancel-b" }),
    "conv-stale",
    "aborted không được ghi session keo dính vào storage",
  );
});
