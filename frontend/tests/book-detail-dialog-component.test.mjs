import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 书籍详情弹窗(参考 PDF_MD_lib 的 BookDetailModal)组件级测试:点卡片打开、
// 元数据渲染、阅读状态切换走 patchDocument、馆藏/已翻译的动作集不同。
//
// 每个 test 一份全新 JSDOM(同一个 jsdom 第二次 createRoot 会停摆)。

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) {
      return value;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function click(dom, element) {
  // Radix Tabs Trigger 挂在 mousedown 上，只 dispatch click 不会切 tab
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

async function bootHomeApp(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../src/pages/home/composition.js");
  const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => dom.window.document.getElementById("app-shell"), "HomeApp 首帧渲染");
  await wait(0);
  return { services, root, host };
}

test("馆藏卡打开书籍详情:元数据 + 阅读状态切换 + 翻译/读原文动作,无对照阅读", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="true"]'),
    "Thẻ lưu trữ đã sẵn sàng",
  );
  const documentId = card.getAttribute("data-document-id");
  click(dom, card);

  const dlg = await waitFor(() => byId("book-detail-dialog"), "Mở hộp thoại chi tiết sách");
  // 标题默认是只读大标题(不是常驻输入框),编辑才出现输入框
  await waitFor(() => dlg.querySelector(".book-detail-title")?.textContent?.trim(), "标题就位");
  assert.equal(byId("book-detail-title-input"), null, "Mặc định chỉ đọc, không có ô nhập tiêu đề");
  assert.ok(dlg.querySelector(".book-detail-status")?.textContent.includes("Chưa dịch"), "Mục lưu trữ hiển thị Chưa dịch");
  // 未翻译：轻量空态 + StageFlow 预览（尚无真实 job，不嵌完整 StatusCard）
  assert.ok(byId("book-detail-translate-progress"), "Mục lưu trữ có bảng tiến độ dịch");
  assert.ok(byId("book-detail-stage-flow"), "Khu vực tiến độ Chưa dịch có bản xem trước StageFlow");
  assert.equal(byId("book-detail-job-status-card"), null, "Chưa dịch không nhúng StatusCard");
  // 馆藏:有翻译 + 读原文,无对照阅读
  assert.ok(byId("book-detail-translate-btn"), "Mục lưu trữ có nút dịch");
  assert.ok(byId("book-detail-read-source-btn"), "Có nút đọc bản gốc");
  assert.equal(byId("book-detail-compare-btn"), null, "Mục lưu trữ không có đọc đối chiếu");
  // 点"编辑"进入标题/标签编辑
  click(dom, byId("book-detail-edit-btn"));
  await waitFor(() => byId("book-detail-title-input"), "点编辑出现标题输入框");

  // 阅读状态切换 → patchDocument(mock),按钮变激活
  const { getMockDocument } = await import("../src/js/mock/documents.js");
  const readBtns = dlg.querySelectorAll(".book-detail-reading-btn");
  const doneBtn = Array.from(readBtns).find((b) => b.textContent === "Đã đọc");
  click(dom, doneBtn);
  await waitFor(() => doneBtn.classList.contains("is-active"), "Đã đọc chuyển sang trạng thái active");
  await waitFor(() => getMockDocument(documentId).reading_status === "done", "patchDocument 落库 reading_status=done");

  root.unmount();
  services.dispose();
  host.remove();
});

test("Thẻ đã dịch mở chi tiết sách: có đọc đối chiếu, không có nút dịch", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  // mock 里 att-001/scl-002 等合成 book 是 succeeded 的已翻译文档
  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="false"][data-status="succeeded"]'),
    "Thẻ đã dịch đã sẵn sàng",
  );
  click(dom, card);

  const dlg = await waitFor(() => byId("book-detail-dialog"), "Mở hộp thoại chi tiết sách");
  // 默认在「简介」：不应弹出工作流对话框
  assert.equal(
    services.stores.dialog.getSnapshot().open,
    false,
    "Mở chi tiết sách không được tự động mở hộp thoại workflow",
  );
  // 已翻译书默认落在「翻译」Tab；进度卡应立刻在 DOM
  await waitFor(
    () => dlg.querySelector(".book-detail-status")?.textContent?.includes("已完成"),
    "Hiển thị trạng thái hoàn thành",
  );
  const statusCard = await waitFor(() => byId("book-detail-job-status-card"), "StatusCard được nhúng trong tab dịch");
  assert.ok(statusCard.classList.contains("bd-job-status-card"), "Thẻ tiến độ dành riêng cho chi tiết");
  assert.equal(statusCard.getAttribute("data-embedded"), "true", "Chế độ embedded");
  assert.ok(
    statusCard.closest("#book-detail-panel-translate"),
    "StatusCard nằm trong bảng tab dịch",
  );
  // 书籍详情专用内部结构（bd-job-status-*），固定高度
  assert.ok(statusCard.classList.contains("bd-job-status-card"), "Lớp gốc bd-job-status-card");
  assert.ok(statusCard.querySelector(".bd-job-status-inner"), "inner độc lập, không phải status-card-shell");
  assert.ok(statusCard.querySelector(".bd-job-status-main"), "Khu vực chính có chiều cao cố định");
  assert.ok(
    statusCard.querySelector(".status-stage-flow .status-stage-step"),
    "Có luồng giai đoạn",
  );
  assert.equal(statusCard.querySelector(".status-card-shell"), null, "Không dùng shell của luồng chính");
  assert.equal(statusCard.querySelector(".status-progress-hero"), null, "Không dùng hero của luồng chính");
  await waitFor(
    () => `${statusCard.getAttribute("data-status") || ""}` === "succeeded"
      || statusCard.querySelector(".status-stage-step.is-active, .status-stage-step.is-done"),
    "StatusCard hoàn thành/có giai đoạn được tô sáng",
  );
  const doneStep = statusCard.querySelector(
    '.status-stage-flow .status-stage-step[data-stage-key="done"]',
  );
  assert.ok(
    doneStep?.classList.contains("is-active")
      || doneStep?.classList.contains("is-selected")
      || doneStep?.classList.contains("is-done"),
    "Giai đoạn hoàn thành được tô sáng",
  );
  const valueText = statusCard.querySelector(".bd-job-status-value")?.textContent?.trim();
  assert.ok(valueText && valueText !== "Đang chuẩn bị", `Trạng thái hoàn thành phải có văn bản tiến độ, thực tế: ${valueText}`);
  // 详情进度卡已从 ring 改为 bar 布局（StatusCardEmbedded：.bd-job-status-percent）
  const pct = statusCard.querySelector(".bd-job-status-percent")?.textContent?.trim();
  assert.equal(pct, "100%", "Thanh tiến độ trạng thái hoàn thành 100%");
  assert.ok(
    statusCard.querySelector(".bd-job-status-bar.is-done"),
    "Thanh tiến độ trạng thái hoàn thành có is-done",
  );
  // 仍然不得弹工作流
  assert.equal(
    services.stores.dialog.getSnapshot().open,
    false,
    "Sau khi chuyển tab dịch / tải tiến độ vẫn không mở hộp thoại workflow",
  );
  assert.ok(byId("book-detail-compare-btn"), "Thẻ đã dịch có đọc đối chiếu");
  assert.equal(byId("book-detail-translate-btn"), null, "Thẻ đã dịch không có nút dịch");
  assert.ok(byId("book-detail-read-source-btn"), "Vẫn có thể đọc bản gốc");

  root.unmount();
  services.dispose();
  host.remove();
});
