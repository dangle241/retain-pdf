import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử cấp component React: tải trực tiếp .jsx qua hook esbuild của tests/helpers/jsx-loader.mjs

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giai đoạn B giới thiệu) dưới jsdom cần cancelAnimationFrame
// (dọn dẹp bộ đếm thời gian hoạt ảnh mount của TabsContent) và getComputedStyle (Presence đọc
// animation-name để判断 hoạt ảnh thoát đã kết thúc) — window của jsdom có triển khai, chỉ là không
// được sao chép vào global trần như requestAnimationFrame, bổ sung ở đây.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { mountLibrarySearchApp } = await import("../src/js/islands/library-search/library-search-app.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("Panel tìm kiếm thư viện: render highlight kết quả và dòng tài liệu, chuyển trạng thái gọi PATCH", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const patchCalls = [];
  let deliverQuery = null;
  const ports = {
    subscribeQuery: (subscriber) => {
      deliverQuery = subscriber;
      subscriber("");
      return () => {};
    },
    searchLibrary: async (q) => ({
      hits: [{
        document_id: "doc-a",
        job_id: "job-a",
        page_idx: 4,
        block_id: "b-1",
        source_snippet: `hit for [${q}] here`,
        translated_snippet: "",
      }],
    }),
    fetchDocumentList: async () => ({
      documents: [{
        document_id: "doc-a",
        title: "Tài liệu kiểm thử",
        source_filename: "test.pdf",
        page_count: 8,
        active_job_id: "job-a",
        reading_status: "unread",
        tags: ["Kiểm thử"],
      }],
    }),
    patchDocument: async (documentId, payload) => {
      patchCalls.push([documentId, payload]);
      return {};
    },
    openReader: () => {},
  };

  const app = mountLibrarySearchApp(host, ports);
  // Khi chạy kiểm thử song song, tải tiến trình không cố định, chờ ngắn cố định sẽ nhận null khi subscribe chưa xảy ra;
  // Polling cho đến khi island hoàn tất subscription (deliverQuery sẵn sàng) rồi mới tiếp tục.
  {
    const deadline = Date.now() + 3000;
    while (typeof deliverQuery !== "function" && Date.now() < deadline) {
      await wait(20);
    }
  }
  assert.equal(typeof deliverQuery, "function", "Island đã subscribe cổng query");
  assert.equal(host.querySelector(".lib-search-panel"), null, "Query trống không render panel");

  deliverQuery("kiểm thử");
  // Tìm kiếm có debounce + fetch bất đồng bộ; khi đầy tải concurrent, 400ms cố định không đủ. Polling cho đến khi đoạn match thực sự được render
  // (panel div sẽ xuất hiện trước, nội dung match điền sau, chỉ chờ panel là không đủ).
  {
    const deadline = Date.now() + 3000;
    while (!host.querySelector(".lib-search-snippet mark") && Date.now() < deadline) {
      await wait(20);
    }
  }

  assert.ok(host.querySelector(".lib-search-panel"), "Panel đã được render");
  assert.equal(host.querySelector(".lib-search-snippet mark")?.textContent, "kiểm thử");
  assert.equal(host.querySelector(".lib-search-doc-title")?.textContent, "Tài liệu kiểm thử");
  assert.equal(host.querySelector(".lib-search-doc-status")?.textContent, "Chưa đọc");

  host.querySelector(".lib-search-doc-status").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true }),
  );
  {
    // Chờ optimistic update (setState + re-render) thực sự biến văn bản trạng thái thành "Đang đọc", thay vì đoán mili giây cố định.
    const deadline = Date.now() + 3000;
    while (host.querySelector(".lib-search-doc-status")?.textContent !== "Đang đọc" && Date.now() < deadline) {
      await wait(20);
    }
  }
  assert.deepEqual(patchCalls, [["doc-a", { reading_status: "reading" }]]);
  assert.equal(host.querySelector(".lib-search-doc-status")?.textContent, "Đang đọc", "Optimistic update có hiệu lực");

  app.unmount();
  host.remove();
});
