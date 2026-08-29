import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Quản lý hội thoại đa phiên (phiên bản React component): phiên bản cũ điều khiển DOM controller của src/js/reader/ai/chat.js,
// từ Phase 2b UI hỏi đáp AI được chuyển vào React (src/pages/reader/legacy/components/ReaderAiChat.jsx).
// Ngữ nghĩa assert giống phiên bản cũ: tên class bong bóng (.reader-ai-message-body-el), tùy chọn dropdown hội thoại,
// số phiên của historyStore. Đồng thời thu nạp hai ngữ nghĩa chat từ reader.test.mjs cũ:
// chuyển trạng thái submit, fallback tìm kiếm cục bộ khi 502.
//
// Cách điều khiển: lần gắn đầu tiên dùng sự kiện DOM thật (submit form/nhấp nút, kiểm tra wiring React);
// các kiểm thử sau gọi trực tiếp orchestration handler qua controllerRef (tương đương kiểm thử cũ gọi chat.submit()) —
// trong môi trường node:test, sau khi đổi key và gắn lại component, event delegation gốc của React bị đình trệ (vấn đề môi trường, trình duyệt không có hiện tượng này),
// việc render component và flushSync không bị ảnh hưởng, các assert vẫn nằm trên DOM thật.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
// Radix Presence/Tabs (giai đoạn B giới thiệu) dưới jsdom cần cancelAnimationFrame
// (dọn dẹp bộ đếm thời gian hoạt ảnh mount của TabsContent) và getComputedStyle (Presence đọc
// animation-name để判断 hoạt ảnh thoát đã kết thúc) — window của jsdom có triển khai, chỉ là không
// được sao chép vào global trần như requestAnimationFrame, bổ sung ở đây.
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
  assert.fail(`Chờ quá thời gian: ${description}`);
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
  };
}

// Root đơn được tái sử dụng cho toàn file: trong môi trường node:test, createRoot thứ hai được tạo mới trong kiểm thử
// không được scheduler flush (cùng hố với reader-drawers.test.mjs), đổi sang đổi key và gắn lại component.
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
        answer: answer || (async ({ question }) => ({ answer: `回答:${question}`, citations: [], scope: "document" })),
      },
    },
  }));
  // Chờ mount + quy trình khởi động (restore→prepare) hoàn tất
  await waitFor(
    () => controllerRef.current && !statusText().includes("Đang"),
    "chat được mount và sẵn sàng",
  );
  return { controller: () => controllerRef.current, historyStore };
}

const bubbleTexts = () =>
  [...documentRef.querySelectorAll(".reader-ai-message .reader-ai-message-body-el")].map((el) => el.textContent);
const selectOptions = () =>
  [...documentRef.getElementById("reader-ai-session-select").options].map((o) => o.textContent);
const statusText = () => documentRef.getElementById("reader-ai-status")?.textContent || "";

test("Kết nối DOM: gửi biểu mẫu tạo bong bóng hỏi đáp, nút hội thoại mới xóa luồng", async () => {
  const { historyStore } = await makeChat();
  // Lần mount đầu tiên: event delegation gốc của React khả dụng, đi qua sự kiện DOM thật để kiểm tra wiring
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "Câu hỏi phiên A");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(
    () => bubbleTexts().some((t) => t.includes("Trả lời:Câu hỏi phiên A")),
    "Gửi DOM tạo bong bóng trả lời",
  );
  assert.ok(bubbleTexts().some((t) => t.includes("Câu hỏi phiên A")));

  documentRef.getElementById("reader-ai-new-btn")
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => bubbleTexts().length === 0, "Luồng hội thoại mới trống");
  assert.equal(historyStore.listSessions().length, 2);
});

test("Chuyển hội thoại: tải lại bong bóng của hội thoại đích", async () => {
  const { controller, historyStore } = await makeChat();
  await controller().submit("Câu hỏi đoạn đầu");
  const idA = historyStore.activeSessionId();
  assert.ok(idA, "Sau lần gửi đầu tiên phải có hội thoại active");

  await controller().newConversation();
  assert.equal(bubbleTexts().length, 0, "Luồng hội thoại mới trống");
  await controller().submit("Câu hỏi đoạn hai");
  assert.ok(bubbleTexts().some((t) => t.includes("Câu hỏi đoạn hai")));
  assert.ok(!bubbleTexts().some((t) => t.includes("Câu hỏi đoạn đầu")));

  await controller().switchConversation(idA);
  assert.ok(bubbleTexts().some((t) => t.includes("Câu hỏi đoạn đầu")), "Bong bóng của A được khôi phục sau khi quay lại");
  assert.ok(!bubbleTexts().some((t) => t.includes("Câu hỏi đoạn hai")));
});

test("Xóa hội thoại hiện tại: loại bỏ và chuyển sang hội thoại còn lại", async () => {
  const { controller, historyStore } = await makeChat();
  await controller().submit("Câu hỏi giữ lại");
  await controller().newConversation();
  await controller().submit("Câu hỏi chờ xóa");
  assert.equal(historyStore.listSessions().length, 2);

  await controller().deleteConversation();
  assert.equal(historyStore.listSessions().length, 1);
  assert.ok(bubbleTexts().some((t) => t.includes("Câu hỏi giữ lại")), "Sau khi xóa sẽ chuyển sang hội thoại được giữ lại");
});

test("Thanh chuyển hội thoại: sau khi gửi, danh sách xuất hiện tùy chọn có tiêu đề", async () => {
  const { controller } = await makeChat();
  await controller().submit("Câu hỏi đặt tên cho phiên");
  await waitFor(
    () => selectOptions().some((t) => t.includes("Câu hỏi đặt tên cho phiên")),
    "Danh sách xuất hiện tiêu đề hội thoại",
  );
});

test("Chuyển trạng thái submit: sau khi hoàn thành trạng thái là 「Có thể tiếp tục đặt câu hỏi」, ô nhập liệu được làm trống", async () => {
  const { controller } = await makeChat();
  await controller().submit("Câu hỏi chuyển trạng thái");
  await waitFor(() => statusText() === "Có thể tiếp tục đặt câu hỏi", "Trạng thái cuối cùng ổn định");
  assert.equal(documentRef.getElementById("reader-ai-input").value, "");
  const texts = bubbleTexts();
  assert.equal(texts.length, 2);
  assert.equal(texts[0], "Câu hỏi chuyển trạng thái");
  assert.equal(texts[1], "Trả lời:Câu hỏi chuyển trạng thái");
});

test("Fallback tìm kiếm cục bộ khi backend 502: trạng thái và chú thích bong bóng", async () => {
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

  await waitFor(() => statusText() === "Đã trả lời bằng tìm kiếm cục bộ", "Trạng thái fallback ổn định");
  const assistantText = bubbleTexts().at(-1);
  assert.match(assistantText, /Local fallback/);
  assert.match(assistantText, /trích dẫn/);
  assert.match(assistantText, /502 provider failed/);
});
