import {
  createStore,
  buildRuntimeStatusCardSnapshot,
  buildJobStatusSummaryViewModel,
  currentJobFinishedAt,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Store + presenter của thẻ trạng thái (thiết kế §2 features/status/, vòng đời §4).
//
// Nguồn VM duy nhất:
// buildRuntimeStatusCardSnapshot trong job-status/status-card-runtime-source.js; phản chiếu trực tiếp ngữ nghĩa
// createRuntimeStatusCardSource trong components/status/connected-job-status-card.js: dù
// renderMain (polling chính gọi) hay renderPatch (bất kỳ một trong ba bản vá phụ events/manifest/stageActions),
// đều thống nhất đọc từ hai canonical store currentJobStore + secondaryResourceStore
// để **tính lại toàn bộ** snapshot và ghi vào statusCardStore (rủi ro thiết kế 10:
// "hội tụ renderPatch"; không vá cục bộ theo nhánh source, tránh ba logic cập nhật cục bộ
// bị lệch độc lập).
//
// Rủi ro 6 (placeholder frame đầu): trong chuỗi đồng bộ của jobRuntimeFeature.startPolling(),
// renderJob() sẽ ghi một snapshot placeholder trước khi await yêu cầu mạng
// (applyJobRuntimeSnapshot trong render-context.js ghi currentJobStore đồng bộ),
// renderMain được gọi đồng bộ ngay lúc đó, vì vậy store này đã có dữ liệu trước lần render đầu của React
// và không chớp thẻ trống.
//
// Cố ý không đưa elapsed vào store này (thiết kế §3.5): resolveLiveDurations thay đổi mỗi giây; nếu ghi cùng
// snapshot chính vào store, useStoreSnapshot của statusCardStore sẽ khiến toàn bộ thẻ render lại mỗi giây;
// đồng hồ thực được useElapsedTicker.js điều khiển độc lập (đọc
// started_at/finished_at trong snapshot.job, không đọc trường elapsed "đã tính sẵn" nào từ store này).

/** Nút thử lại giai đoạn (đầu ra normalizeStageRetryActions). */
export type StatusCardStageRetryAction = {
  stage: string;
  label: string;
  canRetry: boolean;
  disabledReason: string;
  danger: boolean;
};

/** Lát cắt tiến độ giai đoạn (stageProgressByKey / selectedProgress). */
export type StatusCardStageProgress = {
  current?: number;
  total?: number;
  progressCurrent?: number;
  progressTotal?: number;
  displayPercent?: number | null;
  progressText?: string;
  progressUnit?: string;
  progress_unit?: string;
  indeterminate?: boolean;
  progressIndeterminate?: boolean;
  substageKey?: string;
  visualStageKey?: string;
  bySubstage?: Record<string, StatusCardStageProgress>;
  [key: string]: unknown;
};

/** Payload job gốc (hình dạng API rộng, thẻ trạng thái chỉ đọc tập con + chuyển tiếp). */
export type StatusCardJobRecord = {
  job_id?: string;
  status?: string;
  stage?: string;
  stage_detail?: string;
  progress?: {
    percent?: number;
    current?: number;
    total?: number;
    unit?: string;
  };
  progress_percent?: number;
  timestamps?: {
    started_at?: string;
    finished_at?: string;
  };
  started_at?: string;
  finished_at?: string;
  [key: string]: unknown;
};

export type StatusCardSummary = {
  errorText: string;
  fields: {
    jobId: string;
    jobIdInput: string;
    stageDetail: string;
    statusSummary: string;
    finishedAt: string;
    queryFinishedAt: string;
  };
  publicErrorText: string;
};

/**
 * Hình dạng đầy đủ của statusCardStore.snapshot.
 * Các trường đến từ giá trị mặc định EMPTY + buildJobStatusViewModel + hợp nhất summary.
 */
export type StatusCardSnapshot = {
  jobId: string;
  status: string;
  label: string;
  value: string;
  detail: string;
  stageKey: string;
  progressCurrent: number;
  progressTotal: number;
  progressFallbackText: string;
  displayPercent: number | null;
  progressPercent: number;
  progressText: string;
  progressUnit: string;
  progressIndeterminate: boolean;
  substageKey: string;
  errorText: string;
  visualStageKey: string;
  stageProgressByKey: Record<string, StatusCardStageProgress>;
  stageRetryActions: Record<string, StatusCardStageRetryAction>;
  pdfReady: boolean;
  pdfUrl: string;
  markdownBundleReady: boolean;
  markdownBundleUrl: string;
  readerReady: boolean;
  readerUrl: string;
  sourcePdfReady: boolean;
  sourcePdfUrl: string;
  cancelEnabled: boolean;
  /** EMPTY mang giá trị mặc định; runtime lấy StatusCardState.cancelDisabled làm chuẩn. */
  cancelDisabled?: boolean;
  backgroundStages: unknown[];
  job: StatusCardJobRecord | null;
  summary: StatusCardSummary | null;
  /** Phần trình bày giai đoạn có thể đi kèm runtime VM (chuyển tiếp khi merge). */
  stagePresentation?: Record<string, unknown> | null;
  elapsed?: string;
};

export type StatusCardState = {
  snapshot: StatusCardSnapshot;
  cancelDisabled: boolean;
};

export type StatusCardActions = {
  setSnapshot: (state: StatusCardState, snapshot: StatusCardSnapshot) => StatusCardState;
  setCancelDisabled: (state: StatusCardState, disabled?: boolean) => StatusCardState;
};

export type StatusCardStore = Store<StatusCardState, StatusCardActions>;

export type StatusCardPresenter = {
  renderMain: () => void;
  renderPatch: () => void;
  recompute: () => void;
};

type CurrentJobStoreLike = {
  getSnapshot: () => {
    jobId?: string;
    snapshot?: StatusCardJobRecord | null;
  };
};

type SecondaryResourceStoreLike = {
  getSnapshot: () => import("../../../../js/job-status/status-card-runtime-source.js").SecondaryResourceSnapshot;
};

export type StatusCardPresenterDeps = {
  state: Record<string, unknown>;
  currentJobStore: CurrentJobStoreLike;
  secondaryResourceStore: SecondaryResourceStoreLike;
  statusCardStore: StatusCardStore;
};

// Giá trị mặc định không tham số sao chép từ components/status/job-status-card-snapshot.js (file
// thuộc danh sách "bị loại và được họ StatusCard.jsx thay thế", không thể import; js/components/ là
// vùng cấm tường minh của cổng chống hồi quy). Chỉ dùng làm snapshot placeholder khi currentJob chưa tồn tại.
const EMPTY_STATUS_CARD_SNAPSHOT: StatusCardSnapshot = Object.freeze({
  jobId: "",
  status: "",
  label: "Đang chờ",
  value: "Đang chuẩn bị",
  detail: "",
  stageKey: "",
  progressCurrent: NaN,
  progressTotal: NaN,
  progressFallbackText: "-",
  displayPercent: null,
  progressPercent: NaN,
  progressText: "",
  progressUnit: "",
  progressIndeterminate: false,
  substageKey: "",
  errorText: "",
  visualStageKey: "",
  stageProgressByKey: {},
  stageRetryActions: {},
  pdfReady: false,
  pdfUrl: "",
  markdownBundleReady: false,
  markdownBundleUrl: "",
  readerReady: false,
  readerUrl: "",
  sourcePdfReady: false,
  sourcePdfUrl: "",
  cancelEnabled: false,
  cancelDisabled: false,
  backgroundStages: [],
  job: null,
  summary: null,
});

export function createStatusCardStore(): StatusCardStore {
  return createStore<StatusCardState, StatusCardActions>({
    name: "statusCard",
    initialState: {
      snapshot: EMPTY_STATUS_CARD_SNAPSHOT,
      cancelDisabled: false,
    },
    actions: {
      setSnapshot(state, snapshot) {
        return { ...state, snapshot };
      },
      setCancelDisabled(state, disabled = false) {
        return { ...state, cancelDisabled: Boolean(disabled) };
      },
    },
  });
}

export function createStatusCardPresenter({
  state,
  currentJobStore,
  secondaryResourceStore,
  statusCardStore,
}: StatusCardPresenterDeps): StatusCardPresenter {
  function recompute() {
    const currentJob = currentJobStore.getSnapshot();
    const secondaryResources = secondaryResourceStore.getSnapshot();
    // runtime-source nhận string | () => string; dạng hàm dùng finishedAtFallbackForStatusCardRuntime.
    const rawSnapshot = buildRuntimeStatusCardSnapshot({
      currentJob,
      secondaryResources,
      state,
      finishedAtFallback: () => currentJobFinishedAt(state),
    }) as (Partial<StatusCardSnapshot> & { stagePresentation?: Record<string, unknown> | null }) | null;
    if (!rawSnapshot) {
      statusCardStore.actions.setSnapshot(EMPTY_STATUS_CARD_SNAPSHOT);
      return;
    }
    const summary = buildJobStatusSummaryViewModel(
      currentJob?.snapshot || {},
      rawSnapshot.stagePresentation || {},
    ) as StatusCardSummary;
    statusCardStore.actions.setSnapshot({
      ...EMPTY_STATUS_CARD_SNAPSHOT,
      ...rawSnapshot,
      summary,
    });
  }

  return {
    // Hai callback renderJob(renderContext) / renderJobSecondaryPatch({context,source})
    // có chữ ký khác nhau nhưng đều chỉ cần "tính lại một lần"; không dùng bản thân tham số, dữ liệu luôn được đọc từ hai
    // canonical store (controller.js đã ghi xong store đồng bộ trước khi gọi hai callback này).
    renderMain: recompute,
    renderPatch: recompute,
    recompute,
  };
}

export { EMPTY_STATUS_CARD_SNAPSHOT };
