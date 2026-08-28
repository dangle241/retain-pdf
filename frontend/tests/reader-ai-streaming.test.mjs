import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Trạng thái trung gian render streaming (phiên bản React component): trình điều khiển cũ chat.js, Phase 2b chuyển sang React sau đó
// đổi sang render ReaderAiChat và điều khiển qua DOM commit; ngữ nghĩa assertion không đổi — khi onAnswerDelta đến
// bong bóng phải xuất hiện trạng thái render trung gian "chỉ chứa vài đoạn đầu" (chứng minh render song song với stream, không chỉ render một lần ở cuối).

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
// Radix Presence/Tabs (giai đoạn B) trong jsdom cần cancelAnimationFrame
// (dọn timer hoạt ảnh mount của TabsContent) và getComputedStyle (Presence đọc
// animation-name để xác định hoạt ảnh thoát đã kết thúc) — jsdom có sẵn trên window,
// chỉ chưa được sao chép ra global trần như requestAnimationFrame, nên bổ sung ở đây.
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
  assert.fail(`Chờ quá thời gian: ${description}`);
}

test("streaming: bong bóng cập nhật tăng dần khi onAnswerDelta đến (đã có văn bản trung gian trước finalize)", async () => {
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
        answer: async ({ onAnswerDelta }) => {
          for (const chunk of ["Đoạn một. ", "Đoạn hai. ", "Đoạn ba. "]) {
            onAnswerDelta?.((snapshots.at(-1)?.acc || "") + chunk, chunk);
            snapshots.push({ acc: (snapshots.at(-1)?.acc || "") + chunk });
            await wait(130);
            snapshots.push({ mid: bodyText() });
          }
          return { answer: "Đoạn một. Đoạn hai. Đoạn ba. ", citations: [], scope: "document" };
        },
      },
    },
  }));

  await waitFor(() => documentRef.getElementById("reader-ai-input"), "composer đã mount");
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "kiểm tra streaming");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

  await waitFor(() => /Đoạn một\. Đoạn hai\. Đoạn ba\./.test(bodyText()), "trạng thái cuối đầy đủ");
  await wait(50);

  const midTexts = snapshots.filter((s) => "mid" in s).map((s) => s.mid);
  assert.ok(midTexts.some((t) => t.includes("Đoạn một") && !t.includes("Đoạn ba")),
    `phải tồn tại trạng thái render trung gian, thực tế: ${JSON.stringify(midTexts)}`);
  assert.match(bodyText(), /Đoạn một\. Đoạn hai\. Đoạn ba\./);
});
