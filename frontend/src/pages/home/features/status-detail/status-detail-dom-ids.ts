// Bản sao ID hợp đồng DOM của StatusDetailDialog (thiết kế §1 + §0.1).
//
// Sao chép từ src/js/components/dialogs/status-detail-dialog-dom-contract.js (
// toàn bộ thư mục thuộc tầng view custom element cũ; regex chống hồi quy
// `/js/components/` trong architecture-boundaries.test.mjs cấm pages/** import trực tiếp); miền CredentialsDialog
// đã sao chép credentials-dom-ids.js theo cùng cách nên tại đây cũng làm tương tự. Từng chuỗi ID
// được giữ nguyên; baseline hình ảnh (status-dialog-failed/status-dialog-translation) và cổng kiểm tra assert theo
// các ID này; tuyệt đối không đổi tên chuỗi của hệ thống cũ khi thêm/sửa.

export const STATUS_DETAIL_DIALOG_IDS = {
  openButton: "status-detail-btn",
  dialog: "status-detail-dialog",
  headline: {
    icon: "status-detail-head-icon",
    jobId: "status-detail-job-id",
    note: "status-detail-head-note",
    closeButton: "status-detail-close-btn",
  },
  tabs: {
    overview: "detail-tab-overview",
    failure: "detail-tab-failure",
    events: "detail-tab-events",
    translation: "detail-tab-translation",
  },
  panels: {
    overview: "detail-panel-overview",
    failure: "detail-panel-failure",
    events: "detail-panel-events",
    translation: "detail-panel-translation",
  },
  runtime: {
    currentStage: "runtime-current-stage",
    stageElapsed: "runtime-stage-elapsed",
    totalElapsed: "runtime-total-elapsed",
    retryCount: "runtime-retry-count",
    lastTransition: "runtime-last-transition",
    terminalReason: "runtime-terminal-reason",
    inputProtocol: "runtime-input-protocol",
    stageSpecVersion: "runtime-stage-spec-version",
    mathMode: "runtime-math-mode",
  },
  stageHistory: {
    list: "overview-stage-list",
    empty: "overview-stage-empty",
  },
  failure: {
    rerunButton: "failure-rerun-btn",
    rerunStatus: "failure-rerun-status",
    summary: "failure-summary",
    category: "failure-category",
    stage: "failure-stage",
    rootCause: "failure-root-cause",
    suggestion: "failure-suggestion",
    lastLogLine: "failure-last-log-line",
    retryable: "failure-retryable",
  },
  events: {
    status: "events-status",
    empty: "events-empty",
    list: "events-list",
  },
  translation: {
    debugStatus: "translation-debug-status",
    debugEmpty: "translation-debug-empty",
    debugContent: "translation-debug-content",
    countTranslated: "translation-count-translated",
    countPartiallyTranslated: "translation-count-partially-translated",
    countKeptOrigin: "translation-count-kept-origin",
    countFailed: "translation-count-failed",
    providerFamily: "translation-provider-family",
    listFilter: "translation-list-filter",
    filterFinalStatus: "translation-filter-final-status",
    filterQuery: "translation-filter-query",
    filterApply: "translation-filter-apply",
    itemsMeta: "translation-items-meta",
    itemsLoading: "translation-items-loading",
    itemsEmpty: "translation-items-empty",
    itemsList: "translation-items-list",
    itemsPrev: "translation-items-prev",
    itemsPage: "translation-items-page",
    itemsNext: "translation-items-next",
    itemMeta: "translation-item-meta",
    itemLoading: "translation-item-loading",
    itemEmpty: "translation-item-empty",
    itemDetail: "translation-item-detail",
    itemReplay: "translation-item-replay",
    replayStatus: "translation-replay-status",
    replayResult: "translation-replay-result",
  },
};

// ID MARKDOWN_BUNDLE sao chép từ src/js/contracts/download-action-contract.js
// (file đó không nằm trong vùng cấm hồi quy, nhưng ID hàng tải xuống của panel tổng quan thuộc hợp đồng template riêng của StatusDetailDialog
// và là một ID vật lý khác với STATUS_MARKDOWN_BUNDLE trong status-card-dom-ids.js,
// không xung đột; inline trực tiếp để tránh thêm một tầng re-export).
export const STATUS_DETAIL_MARKDOWN_BUNDLE_ID = "markdown-bundle-btn";
