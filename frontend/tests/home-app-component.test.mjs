import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử cấp thành phần HomeApp (Phase 3a: app-shell / upload / workflow khung React ba miền).
// Xác minh: các id hợp đồng DOM tồn tại từng cái, chuỗi đặt lại idle vào store, hợp đồng APP_EVENTS mở/đóng hộp thoại workflow (rủi ro thiết kế 5), kênh setText hộp lỗi, ràng buộc phạm vi trang,
// hiển thị vùng trạng thái → đồng bộ chế độ hộp thoại, giao diện callback 3b được cố định.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giới thiệu giai đoạn B) cần cancelAnimationFrame trong jsdom
// (dọn dẹp bộ đếm thời gian hoạt ảnh mount của TabsContent) và getComputedStyle (đọc Presence
// animation-name xác định hoạt ảnh thoát đã kết thúc) — window của jsdom có triển khai, chỉ là không
// được sao chép vào global trần như requestAnimationFrame, bổ sung ở đây.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../src/pages/home/composition.js");
const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");
const { APP_EVENTS } = await import("../src/js/contracts/app-contract.js");

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
  assert.fail(`Chờ quá thời gian:${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  // Logic kích hoạt Trigger của Radix Tabs nằm trên onMouseDown (không phải onClick) —
  // LibraryTopTabs (cải tạo phân loại) là Radix Tabs đầu tiên trong tệp này, thêm mousedown để
  // mô phỏng nhấp gần với tương tác thực (giống như trong status-detail-dialog-component.test.mjs
  // có sẵn), không ảnh hưởng đến phần tử <button> thuần.
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

// Đầu vào điều khiển: bỏ qua theo dõi value của React, dùng setter gốc ghi rồi bong bóng input
function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function createServices() {
  return createHomeComposition({
    fetchGlossaries: async () => ({
      items: [{ glossary_id: "g-1", name: "bảng thuật ngữ A", entry_count: 3 }],
    }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
}

test("HomeApp: hợp đồng id, chuỗi idle, hợp đồng sự kiện hộp thoại workflow và tương tác", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const events = { open: 0, close: 0 };
  dom.window.document.addEventListener(APP_EVENTS.openTranslationWorkflow, () => { events.open += 1; });
  dom.window.document.addEventListener(APP_EVENTS.closeTranslationWorkflow, () => { events.close += 1; });

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  // Đăng ký useSyncExternalStore của React 18 nằm trong passive effect; DOM khung đầu
  // giữa lúc submit (waitFor ở trên đã thỏa) và đăng ký thực sự có hiệu lực có một nhịp chênh lệch thời gian — trong jsdom
  // không có act() tự động flush passive effects, ở đây nhường một macro task, đảm bảo
  // đăng ký của các store như dialog/statusArea đã được thiết lập, tránh tương tác đầu tiên bên dưới khi đăng ký chưa có hiệu lực
  // trước khi đăng ký có hiệu lực bị bỏ qua (biểu hiện là chờ mở hộp thoại workflow quá thời gian).
  await wait(0);

  // ---- Hợp đồng DOM: cấp cao + các khối gắn thường trực tồn tại từng cái ----
  // Lưu ý: 'translation-workflow-dialog' và toàn bộ họ job-form bên trong (job-form/
  // ocr_provider/.../status-section/job-status-card), 'app-update-dialog'/
  // 'app-update-status'/'app-update-check-btn', 'page-range-dialog' và bên trong nó
  // các id hợp đồng đều không nằm trong danh sách này — sau giai đoạn C (cải tiến shadcn) TranslationWorkflowDialog/
  // SettingsHubDialog/AppUpdateBanner/PageRangeDialog chuyển sang Radix Dialog, không
  // forceMount Content, các id này nằm dưới cây con Content của chúng, chỉ khi hộp thoại tương ứng được
  // mở ra thì mới tồn tại trong DOM (trước đây <dialog> gốc hoặc <div> tùy chỉnh là gắn thường trực,
  // chỉ chuyển trạng thái hiển thị). Sự tồn tại của chúng được chuyển xuống dưới, mở từng hộp thoại rồi mới khẳng định.
  const contractIds = [
    // app-shell
    "app-shell", "developer-btn", "open-output-btn",
    // khung thư viện (giữ chỗ 3b)
    "library-view", "recent-jobs-scroll-body", "recent-jobs-summary", "recent-jobs-empty",
    "library-grid", "recent-jobs-list", "load-more-jobs-btn", "open-query-btn", "library-search-input",
    "library-add-pdf-btn", "app-settings-btn",
  ];
  for (const id of contractIds) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }

  // ---- ba id hợp đồng app-update-*: 'app-update-btn' nằm trong SettingsHubDialog
  //      dưới Content (forceMount của TabsPrimitive.Content làm cho bảng tab 'Cập nhật' dù
  //      không hoạt động vẫn gắn thường trực, chỉ là hidden), mở hộp thoại cài đặt thì tồn tại;
  //      'app-update-dialog'/'app-update-status'/'app-update-check-btn' thì
  //      nội dung dialog chi tiết của AppUpdateBanner (sau giai đoạn C thay máu không
  //      forceMount), cần nhấn nút 'Kiểm tra cập nhật' một lần mới gắn. ----
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-update-btn"), "Sau khi mở hộp thoại cài đặt, app-update-btn được gắn");
  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog"), "Sau khi nhấn kiểm tra cập nhật, app-update-dialog được gắn");
  for (const id of ["app-update-status", "app-update-check-btn"]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }
  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-update-dialog") === null, "Đóng hộp thoại cài đặt");

  // ---- Mở: nút Thêm → dispatch openTranslationWorkflow → mở hộp thoại (lần đầu
  //      mở, đồng thời gắn các id hợp đồng họ job-form + job-status-card) ----
  assert.equal(byId("translation-workflow-dialog"), null, "Không gắn khi chưa mở");
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Mở hộp thoại workflow");
  let dialog = byId("translation-workflow-dialog");
  assert.equal(events.open, 1, "Mở phải qua APP_EVENTS.openTranslationWorkflow (phụ thuộc treo 3b)");
  assert.equal(dialog.dataset.open, "1");
  assert.equal(dialog.classList.contains("is-upload-mode"), true);
  assert.equal(byId("translation-workflow-title").textContent, "Thêm PDF");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), true);
  await waitFor(() => byId("library-add-pdf-btn").getAttribute("aria-expanded") === "true", "Kích hoạt đồng b�� aria của nút");
  assert.equal(byId("library-add-pdf-btn").dataset.workflowOpen, "1");

  // ---- Họ job-form + vùng trạng thái chiếm chỗ hợp đồng id (treo bên trong hộp thoại workflow, chỉ tồn tại trong DOM sau khi đã mở) ----
  const workflowContractIds = [
    "translation-workflow-close-btn", "job-warning",
    "job-form", "ocr_provider", "paddle_token", "api_key",
    "file", "upload-fill", "credential-gate", "credential-gate-title", "credential-gate-help", "credential-gate-action",
    "upload-glyph", "file-label", "upload-help", "upload-status", "upload-progress-panel", "upload-progress-text",
    "inline-page-range", "page-range-start", "page-range-end", "translation-budget-note",
    "upload-action-slot", "page-range-btn", "submit-btn", "error-box-inline",
    "status-section", "job-status-card",
  ];
  for (const id of workflowContractIds) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }

  // ---- Hộp thoại dịch nâng cao (PageRangeDialog, lô cuối giai đoạn C chuyển sang Radix, không forceMount, chỉ gắn vào DOM sau khi đã nhấp mở): nhấp #page-range-btn để mở, các id hợp đồng tồn tại từng cái, sau khi nhấp nút đóng thì gỡ bỏ. Ngữ nghĩa đóng thuần túy của nhấp backdrop/Esc được thống nhất (nhân tiện sửa bug thật: trước đây nhấp backdrop sẽ kích hoạt applyPageRanges(), Esc đi theo đường khác chỉ xóa flag, hai cái không nhất quán) dựa vào kiểm thử Playwright mới — dưới jsdom việc phát hiện outside-pointerdown của Radix DismissableLayer không đáng tin cậy, giống như các tiền lệ kiểm thử đã di chuyển khác (credentials-dialog-component.test.mjs cũng chỉ kiểm tra gắn/nút đóng ở đây, không kiểm tra backdrop/Esc). ----
  assert.equal(byId("page-range-dialog"), null, "Không gắn khi chưa mở");
  click(byId("page-range-btn"));
  await waitFor(() => byId("page-range-dialog") !== null, "Mở hộp thoại dịch nâng cao");
  for (const id of [
    "page-range-title", "page-range-limit-text", "job-glossary-id",
    "page-range-close-btn", "page-range-clear-btn", "page-range-apply-btn",
  ]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }
  click(byId("page-range-close-btn"));
  await waitFor(() => byId("page-range-dialog") === null, "Gỡ hộp thoại sau khi nhấn nút đóng");

  // ---- Chuỗi reset idle: ô tải lên trở về trạng thái mặc định, nút submit bị vô hiệu hóa ----
  assert.equal(byId("file-label").textContent, "Nhấp chọn tệp hoặc kéo vào đây");
  assert.equal(byId("upload-help").textContent, "Chọn PDF, có thể dịch trực tiếp hoặc chỉ lưu vào kệ sách.");
  assert.equal(byId("submit-btn").disabled, true);
  assert.equal(byId("submit-btn").textContent, "Dịch trực tiếp");
  assert.equal(byId("job-warning").classList.contains("hidden"), true);
  assert.equal(byId("status-section").classList.contains("hidden"), true);

  // ---- Kênh setText("error-box"): hiển thị/ẩn inline-error-box (hộp thoại vẫn đang mở,
  //      phần tử đang được gắn) ----
  services.bridge.setText("error-box", "Lỗi kênh tải lên");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === false, "Hiển thị hộp lỗi");
  assert.match(byId("error-box-inline").textContent, /Kênh tải lên bất thường/);
  services.bridge.setText("error-box", "-");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === true, "Ẩn hộp lỗi");

  // ---- Phạm vi trang: hiển thị sau khi trạng thái tải lên sẵn sàng, đầu vào vượt quá giới hạn bị ràng buộc (hộp thoại vẫn mở) ----
  services.ports.uploadStatePort.setUpload({ uploadId: "u-1", uploadedPageCount: 10 });
  services.features.uploadFeature.renderPageRangeSummary();
  await waitFor(() => byId("inline-page-range").classList.contains("hidden") === false, "Hiển thị phạm vi trang");
  typeInput(byId("page-range-start"), "99");
  await waitFor(() => byId("page-range-start").value === "10", "Trang bắt đầu bị giới hạn bởi tổng số trang");

  // ---- Khả năng hiển thị vùng trạng thái → đồng bộ chế độ hộp thoại (hợp đồng statusAreaVisibilityChanged, hộp thoại giữ mở suốt, không cần nhấp lại "Thêm") ----
  services.bridge.setWorkflowSections({ job_id: "job-1", status: "running" });
  await waitFor(() => byId("status-section").classList.contains("hidden") === false, "Hiển thị vùng trạng thái");
  await waitFor(() => dialog.classList.contains("is-status-mode"), "Hộp thoại chuyển sang chế độ trạng thái");
  assert.equal(byId("translation-workflow-title").textContent, "Tiến độ tác vụ");
  services.bridge.setWorkflowSections(null);
  await waitFor(() => byId("status-section").classList.contains("hidden") === true, "Ẩn vùng trạng thái");
  await waitFor(() => dialog.classList.contains("is-upload-mode"), "Hộp thoại quay lại chế độ tải lên");

  // ---- Nhấp × ở chế độ trạng thái = một lần nhấp đóng trực tiếp (không còn hai bước: không returnHome, không bật lại biểu mẫu tải lên; hủy tác vụ do nút "Hủy tác vụ" của StatusCard phụ trách) ----
  services.bridge.setWorkflowSections({ job_id: "job-2", status: "running" });
  await waitFor(() => dialog.classList.contains("is-status-mode"), "Quay lại chế độ trạng thái");
  let returnHomeCount = 0;
  dom.window.document.addEventListener(APP_EVENTS.returnHome, () => { returnHomeCount += 1; });
  const closesBefore = events.close;
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Chế độ trạng thái nhấn × đóng hộp thoại trực tiếp");
  assert.equal(returnHomeCount, 0, "Đóng ở chế độ trạng thái không nên gọi returnHome nữa (hai bước đã bỏ)");
  assert.equal(events.close, closesBefore + 1, "Đóng ở chế độ trạng thái nên phát một sự kiện closeTranslationWorkflow");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), false);

  // ---- Đường dẫn đóng bằng Escape (mở lại → Escape, xác minh Escape cũng hoàn tất một lần và qua sự kiện closeTranslationWorkflow, thư viện 3b làm mới khôi phục phụ thuộc) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Mở lại (chế độ tải lên)");
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Escape đóng hộp thoại");
  assert.equal(events.close, closesBefore + 2, "Escape đóng phải qua APP_EVENTS.closeTranslationWorkflow");

  // ---- Đường dẫn nút đóng (sau khi mở lại đi qua nút đóng; thuận tiện xác minh việc đặt lại phiên của openUpload) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "Mở lại");
  // openUpload sẽ đặt lại phiên tải lên (uploadId được xóa trống)
  assert.equal(services.ports.uploadStatePort.getSnapshot().uploadId, "");
  dialog = byId("translation-workflow-dialog");
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Nút đóng đóng hộp thoại");
  assert.equal(events.close, closesBefore + 3);

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp: phân cột thư viện/bộ sưu tập/yêu thích + hộp thoại quản lý phân loại", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root-categories";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  await wait(0);

  // ---- Hợp đồng phân cột: cả bốn tab đều có, mặc định rơi vào thư viện ----
  assert.ok(byId("library-top-tab-library"), "Thiếu id hợp đồng：#library-top-tab-library");
  assert.ok(byId("library-top-tab-categories"), "Thiếu id hợp đồng：#library-top-tab-categories");
  assert.ok(byId("library-top-tab-favorites"), "Thiếu id hợp đồng：#library-top-tab-favorites");
  assert.ok(byId("library-top-tab-ask"), "Thiếu id hợp đồng：#library-top-tab-ask");
  assert.ok(byId("library-view"), "Mặc định nên ở chế độ xem thư viện");
  assert.equal(byId("categories-view"), null, "Mặc định không gắn kết chế độ xem bộ sưu tập");
  assert.equal(byId("favorites-view"), null, "Mặc định không gắn kết chế độ xem yêu thích");
  assert.equal(byId("home-ask-view"), null, "Mặc định không gắn kết chế độ xem hỏi đáp AI");
  assert.ok(byId("library-search-input"), "Hộp tìm kiếm nên hiển thị trong tab thư viện");

  // ---- Chuyển sang bộ sưu tập: lưới thư viện được gỡ, chế độ xem bộ sưu tập được gắn, hộp tìm kiếm ẩn ----
  click(byId("library-top-tab-categories"));
  await waitFor(() => byId("categories-view") !== null, "Gắn kết chế độ xem bộ sưu tập");
  assert.equal(byId("library-view"), null, "Sau khi chuyển sang bộ sưu tập, chế độ xem thư viện nên được gỡ bỏ");
  assert.equal(byId("favorites-view"), null, "Tab bộ sưu tập không gắn chế độ xem yêu thích");
  assert.equal(byId("library-search-input"), null, "Hộp tìm kiếm nên ẩn trong tab bộ sưu tập");
  assert.ok(byId("categories-create-btn"), "Thiếu id hợp đồng：#categories-create-btn");

  // ---- Hộp thoại tạo bộ sưu tập mới: gắn/id hợp đồng/đóng và gỡ ----
  assert.equal(byId("collection-manage-dialog"), null, "Không gắn khi chưa mở");
  click(byId("categories-create-btn"));
  await waitFor(() => byId("collection-manage-dialog") !== null, "Mở hộp thoại quản lý bộ sưu tập");
  for (const id of ["collection-name-input", "collection-manage-close-btn", "collection-save-btn"]) {
    assert.ok(byId(id), `Thiếu id hợp đồng：#${id}`);
  }
  assert.equal(byId("collection-delete-btn"), null, "Chế độ mới không nên có nút xóa");
  click(byId("collection-manage-close-btn"));
  await waitFor(() => byId("collection-manage-dialog") === null, "Gỡ hộp thoại sau khi nhấn nút đóng");

  // ---- Chuyển sang yêu thích: bộ sưu tập được gỡ, chế độ xem yêu thích được gắn, hộp tìm kiếm vẫn ẩn ----
  click(byId("library-top-tab-favorites"));
  await waitFor(() => byId("favorites-view") !== null, "Gắn chế độ xem yêu thích");
  assert.equal(byId("categories-view"), null, "Sau khi chuyển sang yêu thích, chế độ xem bộ sưu tập nên được gỡ bỏ");
  assert.equal(byId("library-view"), null, "Tab yêu thích nên gỡ chế độ xem thư viện");
  assert.equal(byId("library-search-input"), null, "Hộp tìm kiếm nên ẩn trong tab yêu thích");
  // Một trong bốn trạng thái: đang tải / trống / danh sách / lỗi
  await waitFor(
    () => byId("favorites-loading") || byId("favorites-empty") || byId("favorites-list") || byId("favorites-error"),
    "Chế độ xem yêu thích nên ở một trong các trạng thái loading/trống/danh sách/lỗi",
  );

  // ---- Chuyển sang hỏi đáp AI: yêu thích được gỡ, chế độ xem AI được gắn ----
  click(byId("library-top-tab-ask"));
  await waitFor(() => byId("home-ask-view") !== null, "Gắn chế độ xem hỏi đáp AI");
  assert.equal(byId("favorites-view"), null, "Tab AI nên gỡ chế độ xem yêu thích");
  assert.equal(byId("library-view"), null, "Tab AI nên gỡ chế độ xem thư viện");
  assert.equal(byId("library-search-input"), null, "Hộp tìm kiếm nên ẩn trong tab AI");

  // ---- Quay lại thư viện: yêu thích/AI được gỡ, lưới thư viện và hộp tìm kiếm được khôi phục ----
  click(byId("library-top-tab-library"));
  await waitFor(() => byId("library-view") !== null, "Quay lại thư viện");
  assert.equal(byId("categories-view"), null, "Sau khi quay lại thư viện, chế độ xem bộ sưu tập nên được gỡ bỏ");
  assert.equal(byId("favorites-view"), null, "Sau khi quay lại thư viện, chế độ xem yêu thích nên được gỡ bỏ");
  assert.equal(byId("home-ask-view"), null, "Sau khi quay lại thư viện, chế độ xem AI nên được gỡ bỏ");
  assert.ok(byId("library-search-input"), "Sau khi quay lại thư viện, hộp tìm kiếm nên được khôi phục");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp: chuyển nhanh mục tiêu chỉnh sửa trong hộp thoại quản lý phân loại không bị phản hồi muộn ghi đè (hồi quy)", async () => {
  // Bao phủ hồi quy: open-effect của CollectionManageDialog trước đây không có guard cancelled — nhanh chóng mở hộp thoại cho A, đóng, rồi mở cho B, nếu yêu cầu mạng của A resolve muộn hơn B (trật tự hỗn loạn hoàn toàn có thể xảy ra dưới mạng thật), sẽ ghi đè trạng thái chọn của biểu mẫu đang hiển thị B trở lại dữ liệu cũ của A. Dùng controller giả với thứ tự resolve kiểm soát được để tái hiện trật tự hỗn loạn này.
  const host = dom.window.document.createElement("div");
  host.id = "home-root-race";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const memberResolvers = {};
  function deferredMemberIds(collectionId) {
    return new Promise((resolve) => {
      memberResolvers[collectionId] = resolve;
    });
  }
  services.collections.controller.listAllDocuments = () => Promise.resolve([
    { document_id: "doc-1", title: "Doc One" },
  ]);
  services.collections.controller.listCollectionDocumentIds = (collectionId) => deferredMemberIds(collectionId);

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp render khung đầu tiên");
  await wait(0);

  const dialogStore = services.collections.dialogStore;

  dialogStore.open({ collection_id: "col-a", name: "A" });
  await waitFor(() => byId("collection-manage-dialog") !== null, "Mở A");
  await wait(0);

  dialogStore.close();
  await wait(0);
  dialogStore.open({ collection_id: "col-b", name: "B" });
  await waitFor(() => byId("collection-name-input")?.value === "B", "Chuyển sang B");
  await wait(0);

  // Resolve trật tự hỗn loạn: B (doc-1 không thuộc B) đến trước, A (doc-1 thuộc A) đến sau.
  memberResolvers["col-b"]([]);
  await wait(10);
  const checkboxAfterB = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterB.checked, false, "Trạng thái chọn sách của B nên là chưa chọn (doc-1 không thuộc B)");

  memberResolvers["col-a"](["doc-1"]);
  await wait(10);
  const checkboxAfterLateA = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterLateA.checked, false, "Phản hồi muộn của A không nên ghi đè trạng thái chọn của B trở lại chọn");
  assert.equal(byId("collection-name-input").value, "B", "Tiêu đề biểu mẫu vẫn nên là B, không bị phản hồi muộn của A kéo theo");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp: định hình interface cầu nối callback 3b (blueprint §4)", () => {
  const services = createServices();
  // Tên callback cần thiết cho việc kết nối mountJobRuntimeFeature / status-detail / credentials
  const bridgeContract = [
    "setText",
    "setWorkflowSections",
    "setLinearProgress",
    "updateActionButtons",
    "renderPageRangeSummary",
    "resetUploadProgress",
    "resetUploadedFile",
    "applyWorkflowMode",
    "updateJobWarning",
    "resetEventsList",
    "activateDetailTab",
    "setSubmitBusy",
    "submitForm",
  ];
  for (const name of bridgeContract) {
    assert.equal(typeof services.bridge[name], "function", `Thiếu bridge.${name}`);
  }
  // Điểm tiêm workflow-open-port 3b
  assert.equal(typeof services.workflowDialog.isOpen, "function");
  assert.equal(services.workflowDialog.isOpen(), false);
  services.dispose();
});
