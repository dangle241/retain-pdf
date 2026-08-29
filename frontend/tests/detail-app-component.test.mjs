import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// DetailApp (Radix Dialog: trang chi tiết nhiệm vụ) kiểm thử cấp component:
// Tải .jsx trực tiếp qua móc esbuild của tests/helpers/jsx-loader.mjs.
// Xác nhận: tải bố cục (overview → markdown), kết nối setText/setActionLink,
// thao tác mệnh lệnh (danh sách tạo phẩm), tải ngắt quãng danh sách sự kiện cùng mở/đóng dialog.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/detail.html?job_id=job-react-detail" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giai đoạn B) cần cancelAnimationFrame trong jsdom
// (dọn dẹp bộ hẹn giờ mount animation của TabsContent) và getComputedStyle 
// (Presence đọc animation-name xác định animation thoát kết thúc) — jsdom window 
// có implement, chỉ là không được sao chép vào global như requestAnimationFrame.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { DetailApp } = await import("../src/pages/detail/DetailApp.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chạy song song — thời gian tải biến động theo áp lực tiến trình; dùng polling thay vì chờ cố định (tối đa 3s).
async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(20);
  }
  assert.fail(`Hết thời gian chờ: ${description}`);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function makePorts() {
  const payloadRaw = {
    job_id: "job-react-detail",
    status: "succeeded",
    display_stage: "done",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:03:00Z",
    finished_at: "2026-06-01T00:03:00Z",
    runtime: {
      stage_history: [
        {
          stage: "translating",
          display_stage: "translation",
          enter_at: "2026-06-01T00:00:00Z",
          exit_at: "2026-06-01T00:01:00Z",
          duration_ms: 60000,
        },
        {
          stage: "rendering",
          display_stage: "render",
          enter_at: "2026-06-01T00:01:00Z",
          exit_at: "2026-06-01T00:03:00Z",
          duration_ms: 120000,
        },
      ],
    },
    artifacts: {
      markdown: {
        ready: true,
        json_url: "/api/v1/jobs/job-react-detail/markdown",
        raw_url: "/api/v1/jobs/job-react-detail/markdown/raw",
      },
    },
    actions: {
      download_pdf: { enabled: true, url: "/api/v1/jobs/job-react-detail/pdf" },
    },
  };
  const manifestPayload = {
    items: [
      { artifact_key: "source_pdf", ready: true, resource_path: "/api/v1/jobs/job-react-detail/artifacts/source_pdf" },
      { artifact_key: "translated_pdf", ready: true, resource_path: "/api/v1/jobs/job-react-detail/pdf" },
    ],
  };
  const eventItems = [
    { seq: 1, event: "stage_transition", level: "info", message: "Bắt đầu biên dịch", display_stage: "translation" },
    { seq: 2, event: "stage_transition", level: "info", message: "Hoàn thành render", display_stage: "render" },
  ];
  const calls = { events: [] };
  return {
    calls,
    getJobId: () => "job-react-detail",
    configPort: { detailShareNote: () => "Văn bản khuyến nghị chia sẻ (kiểm thử)" },
    resumePort: { submit: async () => ({ job_id: "job-next" }) },
    dataPort: {
      apiPrefix: "/api/v1",
      loadOverview: async () => ({
        diagnosticsPayload: null,
        manifestPayload,
        payloadRaw,
        resumePlan: { can_resume: true, from_stage: "translation" },
      }),
      loadMarkdownPayload: async () => ({
        content: "# Tài liệu kiểm thử\n\nNội dung chính",
        file_name: "book.md",
        json_url: "/api/v1/jobs/job-react-detail/markdown",
        raw_url: "/api/v1/jobs/job-react-detail/markdown/raw",
        images: [],
      }),
      fetchJobEvents: async (jobId, apiPrefix, limit, offset) => {
        calls.events.push([jobId, apiPrefix, limit, offset]);
        return { items: eventItems };
      },
      fetchProtected: async () => {
        throw new Error("Bài kiểm thử này không nên thực hiện yêu cầu được bảo vệ");
      },
      rerunJob: async () => ({}),
      resumeJob: async () => ({}),
    },
  };
}

test("DetailApp:tải bố cục, điều chỉnh văn bản, đảo tạo phẩm, hộp thoại luồng sự kiện", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "detail-root";
  dom.window.document.body.appendChild(host);

  const ports = makePorts();
  const root = createRoot(host);
  root.render(React.createElement(DetailApp, {
    configPort: ports.configPort,
    dataPort: ports.dataPort,
    getJobId: ports.getJobId,
    resumePort: ports.resumePort,
  }));
  // Chờ overview + markdown hai đoạn bố trí bất đồng bộ hoàn toàn
  await waitFor(
    () => /Đã tải/.test(byId("detail-markdown-status")?.textContent || ""),
    "Trạng thái markdown sẵn sàng",
  );

  // Đầu trang: job id và gợi ý chia sẻ đi qua setText
  assert.equal(byId("detail-job-id")?.textContent, "job-react-detail");
  assert.equal(byId("detail-head-note")?.textContent, "Văn bản khuyến nghị chia sẻ (kiểm thử)");
  assert.notEqual(byId("detail-status-summary")?.textContent, "-");

  // Khôi phục điểm gián đoạn: resumePlan khôi phục được → nội dung và trạng thái nút (ghi mệnh lệnh)
  assert.match(byId("detail-rerun-status")?.textContent || "", /Có thể khôi phục từ translation/);
  assert.equal(byId("detail-rerun-btn")?.disabled, false);

  // Liên kết hành động: setActionLink (reader/pdf đều sẵn sàng)
  assert.equal(byId("detail-reader-btn")?.classList.contains("disabled"), false);
  assert.equal(byId("detail-reader-btn")?.getAttribute("aria-disabled"), "false");
  assert.equal(byId("detail-pdf-btn")?.classList.contains("disabled"), false);

  // Danh sách tạo phẩm: artifacts.js giữ lại qua overview-renderer ghi vào container React
  assert.equal(byId("detail-artifacts-summary")?.textContent, "Có 2 mục");
  assert.equal(host.querySelectorAll(".detail-artifact-row").length, 2);

  // Markdown: tái sử dụng markdown-flow → trạng thái và xem trước
  assert.match(byId("detail-markdown-status")?.textContent || "", /Đã tải \/markdown JSON/);
  assert.match(byId("detail-markdown-preview")?.textContent || "", /# Tài liệu kiểm thử/);
  assert.equal(byId("detail-markdown-image-count")?.textContent, "0");

  // Hộp thoại mốc thời gian giai đoạn (giai đoạn C đợt cuối chuyển sang Radix Dialog, không forceMount:
  // khi đóng toàn bộ Content không gắn vào DOM, assertion đổi từ "hidden class" sang "có gắn hay không"):
  // Mở mục render, Escape đóng
  assert.equal(byId("detail-stage-history-modal"), null, "Ban đầu chưa mở thì không gắn");
  click(byId("detail-open-stage-history-btn"));
  await waitFor(
    () => byId("detail-stage-history-modal") !== null,
    "Hộp thoại mốc thời gian giai đoạn mở",
  );
  // Radix Dialog Content dùng Portal, render vào document.body thay vì cây con host,
  // assertion đổi từ phạm vi host sang toàn document (theo ví dụ các hộp thoại đã chuyển khác).
  assert.equal(dom.window.document.querySelectorAll(".detail-stage-item").length, 2);
  assert.match(dom.window.document.querySelector(".detail-stage-item .detail-stage-title")?.textContent || "", /^1\. /);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(
    () => byId("detail-stage-history-modal") === null,
    "Escape đóng hộp thoại mốc thời gian giai đoạn",
  );

  // Luồng sự kiện: phân trang theo yêu cầu + bộ nhớ trong trang + chữ nút thành «Xem»
  assert.equal(byId("detail-open-events-btn")?.textContent, "Tải theo yêu cầu");
  assert.equal(byId("detail-events-modal"), null, "Ban đầu chưa mở thì không gắn");

  await waitFor(
    () => byId("detail-events-modal") !== null,
    "Mục luồng sự kiện render",
  );
  assert.ok(byId("detail-events-modal"), "Hộp thoại luồng sự kiện đã gắn");

  assert.equal(byId("detail-events-status")?.textContent, "Tất cả sự kiện · 2 mục");
  assert.equal(byId("detail-open-events-btn")?.textContent, "Xem");

  // Mở lại không gửi yêu cầu trùng lặp (bộ nhớ trong trang)
  click(byId("detail-close-events-btn"));
  await waitFor(
    () => byId("detail-events-modal") === null,
    "Đóng hộp thoại luồng sự kiện",
  );
  click(byId("detail-open-events-btn"));
  await waitFor(
    () => byId("detail-events-modal") !== null,
    "Mở lại hộp thoại luồng sự kiện",
  );
  assert.equal(ports.calls.events.length, 1);

  root.unmount();
  host.remove();
});

test("DetailApp:thiếu job_id thì cảnh báo và không gửi yêu cầu", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  let overviewCalls = 0;
  const root = createRoot(host);
  root.render(React.createElement(DetailApp, {
    configPort: { detailShareNote: () => "share" },
    dataPort: {
      apiPrefix: "/api/v1",
      loadOverview: async () => {
        overviewCalls += 1;
        return {};
      },
      loadMarkdownPayload: async () => null,
      fetchJobEvents: async () => ({ items: [] }),
      fetchProtected: async () => ({}),
    },
    getJobId: () => "",
    resumePort: { submit: async () => ({}) },
  }));
  await waitFor(
    () => host.querySelector("#detail-head-note")?.textContent === "Thiếu job_id, vui lòng mở bằng detail.html?job_id=...",
    "Thiếu job_id cảnh báo",
  );
  assert.equal(overviewCalls, 0);

  root.unmount();
  host.remove();
});
