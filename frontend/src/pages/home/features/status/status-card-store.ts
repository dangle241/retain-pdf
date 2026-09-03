import {
  createStore,
  buildRuntimeStatusCardSnapshot,
  buildJobStatusSummaryViewModel,
  currentJobFinishedAt,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// Status card store + presenter (Blueprint §2 features/status/, §4 lifecycle).
//
// Single VM source: job-status/status-card-runtime-source.js buildRuntimeStatusCardSnapshot——
// directly mirrors components/status/ connected-job-status-card.js createRuntimeStatusCardSource semantics:
// regardless of whether renderMain (main poll hit) or renderPatch (any of the three secondary patches:
// events/manifest/stageActions), always recomputes a full snapshot from currentJobStore +
// secondaryResourceStore and writes it back to statusCardStore (Blueprint risk 10:
// "renderPatch convergence"——no per-source-branch partial patching; avoids three partial-update
// logic paths drifting apart).
//
// Risk 6 (first-frame placeholder): in jobRuntimeFeature.startPolling() sync chain,
// renderJob() places a placeholder snapshot before awaiting the network request
// (render-context.js applyJobRuntimeSnapshot writes currentJobStore synchronously).
// renderMain is called synchronously at this moment, so the books store already has data
// before React's first render——no empty card flash.
//
// elapsed deliberately not in books store (Blueprint §3.5): resolveLiveDurations changes every
// second; if written to store alongside main snapshot, statusCardStore's useStoreSnapshot would
// re-render the whole card every second. The real timer is driven independently by
// useElapsedTicker.js (reads snapshot.job started_at/finished_at; does not read any
// "pre-computed" elapsed field from books store).

/** StageRetry button (output of normalizeStageRetryActions) */
export type StatusCardStageRetryAction = {
  stage: string;
  label: string;
  canRetry: boolean;
  disabledReason: string;
  danger: boolean;
};

/** StageProgress slice (stageProgressByKey / selectedProgress) */
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

/** job raw payload (wide API shape; Status card read-only subset + passthrough) */
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
 * Full shape of statusCardStore.snapshot.
 * Fields from EMPTY defaults + buildJobStatusViewModel + summary merge.
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
  /** EMPTY carries defaults; runtime uses StatusCardState.cancelDisabled */
  cancelDisabled?: boolean;
  backgroundStages: unknown[];
  job: StatusCardJobRecord | null;
  summary: StatusCardSummary | null;
  /** Stage presentation that runtime VM may attach (passed through during merge) */
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

// Copied from components/status/job-status-card-snapshot.js zero-arg defaults (that file
// is "dead", on the "to be replaced by StatusCard.jsx family" list; cannot import——js/components/
// is an explicit forbidden zone for bounce-back prevention). Only used as placeholder snapshot
// when currentJob does not yet exist.
const EMPTY_STATUS_CARD_SNAPSHOT: StatusCardSnapshot = Object.freeze({
  jobId: "",
  status: "",
  label: "Waiting",
  value: "Preparing",
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
    // runtime-source accepts string | () => string; function form uses finishedAtFallbackForStatusCardRuntime
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
    // renderJob(renderContext) / renderJobSecondaryPatch({context,source}) two callbacks
    // have different signatures, but both only require "recompute once"——the params themselves
    // are unused; data always read from two canonical stores (controller.js has already
    // synchronously written to store before calling these callbacks).
    renderMain: recompute,
    renderPatch: recompute,
    recompute,
  };
}

export { EMPTY_STATUS_CARD_SNAPSHOT };




