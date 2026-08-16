// Logic tổ hợp của StatusDetailDialog (nơi triển khai bảng quyết định thiết kế §1).
//
// Quan hệ với features/status-detail/controller.js của hệ thống cũ (khác biệt quan trọng, cần ghi vào báo cáo):
// Giá trị công khai controller.js trả về chỉ có { activateDetailTab, bindEvents,
// openStatusDetailDialog, buildDetailPageUrl, ensureTranslationData,
// syncRerunAction, ensureOverviewData } —— applyFilter/changePage/loadItem/
// toàn bộ replay/rerunCurrentJob là closure nội bộ, chỉ có thể được gọi qua
// event-commands.js gắn bởi bindEvents() (ủy quyền click trên document, thiết kế do sự kiện DOM điều khiển). Component JSX cần
// gọi trực tiếp các hành động này (select/input có kiểm soát, onClick của nút); bề mặt công khai hẹp kiểu "callback chỉ nhận
// sự kiện DOM" không khả thi trong React.
//
// Vì vậy file này không import controller.js/translation-tab-port.js/
// event-commands.js/navigation-view-port.js/dialog-view-port.js/
// resume-view-port.js/translation-renderer.js/view.js (danh sách loại bỏ theo thiết kế + đều thuộc
// vùng cấm hồi quy của architecture-boundaries), mà tổ hợp trực tiếp tầng logic thuần được thiết kế đánh dấu "giữ lại":
// overview-coordinator.js / resume-actions.js / translation-data-port.js /
// translation-tab-coordinator.js / translation-state.js / status-detail/
// snapshot.js: dùng callback viewPort/render* riêng để ghi đầu ra của chúng vào
// status-detail-store.js thay vì nối DOM markup. Từng phương thức được
// expose lại ở tầng pages để JSX gọi trực tiếp.

import type { StatusDetailRuntimePort } from "./status-detail-runtime-port.js";
import type { StatusDetailStore, StatusDetailTranslation } from "./status-detail-store.js";
import type { StatusDetailDialogStore } from "./status-detail-dialog-store.js";
import {
  buildStatusDetailSnapshot,
  resolveJobActions,
  createStatusDetailOverviewCoordinator,
  rerunCurrentJob as rerunCurrentJobAction,
  syncRerunAction as syncRerunActionState,
  createStatusDetailTranslationDataPort,
  createStatusDetailTranslationTabCoordinator,
  createTranslationState,
  defaultStatusDetailConfigPort,
} from "../../composition/external.js";
import type {
  JobLike,
  JobPayload,
  EventsPayload,
} from "../../composition/external.js";

export type JobActionResolver = typeof resolveJobActions;

export interface StatusDetailResumeViewPort {
  closeDialog: () => void;
  setRerunAction: (options?: { enabled?: boolean; status?: string }) => void;
  setRerunDisabled: (disabled: boolean) => void;
}

export interface StatusDetailOverviewRenderContext {
  job?: JobLike | JobPayload | null;
  events?: EventsPayload | null;
  jobId?: string;
  [key: string]: unknown;
}

export interface StatusDetailControllerDeps {
  runtimePort: StatusDetailRuntimePort;
  apiPrefix?: string;
  fetchJobPayload?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchJobEvents?: (
    jobId: string,
    apiPrefix?: string,
    limit?: number,
    offset?: number,
  ) => Promise<unknown>;
  fetchJobDiagnostics?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchResumePlan?: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationDiagnostics: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationItems: (
    jobId: string,
    apiPrefix?: string,
    query?: StatusDetailTranslation["query"] | Record<string, unknown>,
  ) => Promise<unknown>;
  fetchTranslationItem: (jobId: string, itemId: string, apiPrefix?: string) => Promise<unknown>;
  replayTranslationItem: (jobId: string, itemId: string, apiPrefix?: string) => Promise<unknown>;
  retryJobStage: (
    jobId: string,
    apiPrefix: string | undefined,
    stage: string,
    payload?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  rerunJob: (actionUrl: string) => Promise<unknown>;
  renderJob?: (context?: StatusDetailOverviewRenderContext | null) => void;
  startPolling?: (jobId: string) => void;
  setText?: (id: string, message: string) => void;
  store: StatusDetailStore;
  dialogStore: StatusDetailDialogStore;
  jobActionResolver?: JobActionResolver;
}

export function createStatusDetailController({
  runtimePort,
  apiPrefix,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchResumePlan,
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
  retryJobStage,
  rerunJob,
  renderJob,
  startPolling,
  setText,
  store,
  dialogStore,
  jobActionResolver = resolveJobActions,
}: StatusDetailControllerDeps) {
  function getCurrentJobId() {
    return runtimePort.currentJobId();
  }

  // ---- resume/rerun (giữ resume-actions.js; chuyển resumeViewPort sang điều khiển bằng store,
  //      không còn dùng truy vấn DOM dialogComponent() của view.js) ----
  const resumeViewPort: StatusDetailResumeViewPort = {
    closeDialog: () => dialogStore.close(),
    setRerunAction: ({ enabled, status }: { enabled?: boolean; status?: string } = {}) => {
      store.actions.setOverview({ rerun: { enabled: Boolean(enabled), status: status || "" } });
    },
    setRerunDisabled: (disabled: boolean) => store.actions.setRerunPending(disabled),
  };

  function syncRerunAction(statusText = "") {
    return syncRerunActionState({
      ...runtimePort.rerunContext(),
      statusText,
      viewPort: resumeViewPort,
      resolveActions: jobActionResolver,
    });
  }

  async function rerunCurrentJob() {
    await rerunCurrentJobAction({
      rerunContext: runtimePort.rerunContext(),
      rerunJob,
      setText,
      startPolling,
      viewPort: resumeViewPort,
      resolveActions: jobActionResolver,
    });
  }

  async function renderManualTranslation() {
    const jobId = getCurrentJobId();
    if (!jobId) {
      throw new Error("Không tìm thấy Job ID để kết xuất bản dịch.");
    }
    const snapshot = (runtimePort.currentJobSnapshot() || {}) as Record<string, unknown>;
    const raw = snapshot.raw_response && typeof snapshot.raw_response === "object"
      ? snapshot.raw_response as Record<string, unknown>
      : snapshot;
    const text = (...keys: string[]) => {
      for (const key of keys) {
        const value = `${snapshot[key] ?? raw[key] ?? ""}`.trim();
        if (value) return value;
      }
      return "";
    };
    store.actions.setRerunPending(true);
    try {
      const result = await retryJobStage(jobId, apiPrefix, "render", {
        create_new_job: true,
        document_id: text("document_id"),
        title: text("title", "display_name"),
        display_name: text("display_name", "title"),
        page_count: snapshot.page_count ?? raw.page_count,
        cover_url: text("cover_url"),
        thumbnail_url: text("thumbnail_url"),
      });
      const nextJobId = `${result.job_id || ""}`.trim();
      if (!nextJobId) {
        throw new Error("Backend không trả về Job ID của tác vụ kết xuất.");
      }
      dialogStore.close();
      startPolling?.(nextJobId);
      return result;
    } finally {
      store.actions.setRerunPending(false);
    }
  }

  // ---- overview (giữ overview-coordinator.js; renderOverviewSnapshot ghi vào
  //      store, job/eventsPayload lưu giá trị gốc; bảng quyết định thiết kế §1: history.js/
  //      không dùng phần nối markup của events.js; StageHistoryList/EventsList lấy từ
  //      hai trường gốc này và dùng hàm thuần để tính mảng có cấu trúc tương ứng) ----
  function renderOverviewSnapshot(context: StatusDetailOverviewRenderContext | null | undefined) {
    const job = context?.job || null;
    const eventsPayload = context?.events || null;
    if (!job) {
      return;
    }
    const finishedAtFallback = runtimePort.currentJobFinishedAt();
    const snapshot = buildStatusDetailSnapshot(job, eventsPayload, {
      durationOptions: { finishedAtFallback },
    });
    store.actions.setOverview({
      headline: snapshot.headline,
      runtime: snapshot.runtime,
      failure: snapshot.failure,
      rerun: snapshot.rerun,
      job: job as Record<string, unknown>,
      eventsPayload: eventsPayload as { items?: unknown[]; [key: string]: unknown } | null,
      finishedAtFallback,
    });
    syncRerunAction();
  }

  const overviewTab = createStatusDetailOverviewCoordinator({
    runtimePort,
    apiPrefix,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobDiagnostics,
    fetchResumePlan,
    renderJob,
    renderOverviewSnapshot,
    setErrorText: (message: string) => setText?.("error-box", message),
  });

  async function ensureOverviewData({ force = false }: { force?: boolean } = {}) {
    await overviewTab.ensureLoaded({ force });
  }

  // ---- translation(translation-data-port.js + translation-tab-coordinator.js
  //      giữ lại; callback render* đổi thành "sao chép nông translationState vào store"; phần
  //      translation của store là bản phản chiếu túi trạng thái này, cộng một ít trạng thái UI thuần (*Loading/
  //      *ErrorText)) ----
  const translationState = createTranslationState();
  const dataPort = createStatusDetailTranslationDataPort({
    translationState,
    apiPrefix,
    currentJobId: getCurrentJobId,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
  });

  function syncTranslation(extra: Partial<StatusDetailTranslation> = {}) {
    store.actions.setTranslation({ ...translationState, ...extra });
  }

  const translationTab = createStatusDetailTranslationTabCoordinator({
    dataPort,
    renderEmpty: (message: string) => syncTranslation({
      emptyMessage: message,
      itemsLoading: false,
      itemDetailLoading: false,
    }),
    renderSummary: () => syncTranslation({ emptyMessage: "" }),
    renderItems: (options: { loading?: boolean; emptyText?: string } = {}) => syncTranslation({
      itemsLoading: Boolean(options.loading),
      itemsErrorText: options.loading ? "" : (options.emptyText || ""),
    }),
    renderItemDetail: (options: { loading?: boolean } = {}) => syncTranslation({
      itemDetailLoading: Boolean(options.loading),
    }),
    renderReplay: () => syncTranslation({ replayLoading: false }),
    setReplayLoading: (payload: { hasResult?: boolean } | null) => syncTranslation({
      replayLoading: Boolean(payload && !payload.hasResult),
    }),
  });

  async function ensureTranslationData({ force = false }: { force?: boolean } = {}) {
    await translationTab.ensureLoaded({ force });
  }

  async function applyTranslationFilter(query: { finalStatus?: string; q?: string }) {
    await translationTab.applyFilter(query);
  }

  async function changeTranslationPage(direction: string) {
    await translationTab.changePage(direction);
  }

  async function selectTranslationItem(itemId: string) {
    const normalizedItemId = `${itemId || ""}`.trim();
    if (!normalizedItemId) {
      return;
    }
    try {
      await translationTab.loadItem(getCurrentJobId(), normalizedItemId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      syncTranslation({ itemErrorText: message, itemDetailLoading: false });
    }
  }

  async function replayCurrentItem() {
    try {
      await translationTab.replaySelected();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      syncTranslation({ replayErrorText: message, replayLoading: false });
    }
  }

  // ---- Điểm vào công khai thống nhất (thiết kế §1: #status-detail-btn trong ResultActions.jsx gọi trực tiếp
  //      openStatusDetailDialog("overview"), không phân phát sự kiện) ----
  function activateDetailTab(name = "overview") {
    dialogStore.open({ activeTab: name });
    if (name === "translation") {
      void ensureTranslationData();
      return;
    }
    void ensureOverviewData();
  }

  function openStatusDetailDialog(tabName = "overview") {
    activateDetailTab(tabName);
  }

  function buildDetailPageUrl(jobId: string) {
    return defaultStatusDetailConfigPort.buildDetailPageUrl(jobId);
  }

  return {
    activateDetailTab,
    openStatusDetailDialog,
    buildDetailPageUrl,
    ensureOverviewData,
    ensureTranslationData,
    applyTranslationFilter,
    changeTranslationPage,
    selectTranslationItem,
    replayCurrentItem,
    rerunCurrentJob,
    renderManualTranslation,
    syncRerunAction,
  };
}

export type StatusDetailController = ReturnType<typeof createStatusDetailController>;
