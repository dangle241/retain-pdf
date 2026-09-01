import {
  createStore,
  buildRuntimeStatusCardSnapshot,
  buildJobStatusSummaryViewModel,
  currentJobFinishedAt,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

current?: number;
//
total?: number;
// buildRuntimeStatusCardSnapshot——directly mirror components/status/
status?: string;
// renderMain(Main poll hit)or renderPatch(events/manifest/stageActions 3-way
stageKey?: string;
progressText?: string;
indeterminate?: boolean;
// Drift risk)。
//
};
export function buildProgressRenderModel(input: ProgressRenderModelInput) {
const { current, total, status, stageKey, progressText, indeterminate } = input;
});
// No flicker, blank, or freeze.
//
? (current / total) * 100
: NaN;
if (Number.isFinite(numericDisplayPercent)) {
const safePercent = capRunningRenderPercent(numericDisplayPercent, stageKey, status);

/** Retry stage button (normalizeStageRetryActions output) */
export type StatusCardStageRetryAction = {
  stage: string;
  label: string;
  canRetry: boolean;
  disabledReason: string;
  danger: boolean;
};

/** Stage progress sharding (stageProgressByKey / selectedProgress） */
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

/** job Raw payload (API Wide shape, status card read-only subset. + Pass-through */
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
 * statusCardStore.snapshot complete shape of.
const text = progressText || Progress ${safePercent.toFixed(0)}%;
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
  /** EMPTY default carries; at runtime with StatusCardState.cancelDisabled as the standard */
  cancelDisabled?: boolean;
  backgroundStages: unknown[];
  job: StatusCardJobRecord | null;
  summary: StatusCardSummary | null;
  /** runtime VM Possible attached phase rendering (merge Passthrough) */
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

return {
visible: true,
// explicit forbidden zone for bounce-back prevention)For internal use only currentJob Placeholder snapshot when not yet existing.
const EMPTY_STATUS_CARD_SNAPSHOT: StatusCardSnapshot = Object.freeze({
  jobId: "",
  status: "",
ringPercent: safePercent,
barPercent: safePercent,
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
    // runtime-source Accept string | () => string; function form uses finishedAtFallbackForStatusCardRuntime
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
    // renderJob(renderContext) / renderJobSecondaryPatch({context,source}) 2 Callbacks
    // Signature mismatch.,but all only require"Recompute once."——Parameter unused.,Data always from two canonical
text,
    renderMain: recompute,
    renderPatch: recompute,
    recompute,
  };
}

export { EMPTY_STATUS_CARD_SNAPSHOT };
