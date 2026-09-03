import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// StatusDetailDialog read-side store (blueprint §1 "new store" list).
//
// Two parallel segments (data source iron law, blueprint §1.0 + §0 global found):
// - overview segment: headline/runtime/failure/rerun/job/eventsPayload — job/
//   eventsPayload are raw data (not pre-built markup), consumed directly by
//   StageHistoryList/EventsList using pure functions on these two fields
//   (see corresponding component files).
// - translation segment: shallow copy of createTranslationState() Status bag
//   + small amount of UI state (itemsLoading/itemDetailLoading/replayLoading/
//   emptyMessage/errorText), synced after every read/write via
//   translation-data-port.js (kept).
//
// This store and status-card-store.js's statusCardStore are two parallel read
// paths; they are not merged — status-detail fetches its own
// (events/diagnostics/resumePlan) and writes far less frequently than StatusCard's
// 1s polling; merging would pollute StatusCard's high-frequency subscription
// snapshots (blueprint §1.0 explicit iron law).

export type StatusDetailHeadline = {
  iconMarkup: string;
  jobId: string;
  note: string;
};

export type StatusDetailRuntime = {
  currentStage: string;
  stageElapsed: string;
  totalElapsed: string;
  retryCount: string;
  lastTransition: string;
  terminalReason: string;
  inputProtocol: string;
  stageSpecVersion: string;
  mathMode: string;
};

export type StatusDetailFailure = {
  summary: string;
  category: string;
  stage: string;
  rootCause: string;
  suggestion: string;
  lastLogLine: string;
  retryable: string;
};

export type StatusDetailRerun = {
  enabled: boolean;
  status: string;
};

/** Raw job payload (StageHistoryList etc. consume directly; API shape is wide) */
export type StatusDetailJobPayload = Record<string, unknown>;

/** Raw events payload (EventsList consumes directly) */
export type StatusDetailEventsPayload = {
  items?: unknown[];
  [key: string]: unknown;
};

/** overview segment: buildStatusDetailSnapshot + job/events raw payloads */
export type StatusDetailOverview = {
  headline: StatusDetailHeadline;
  runtime: StatusDetailRuntime;
  failure: StatusDetailFailure;
  rerun: StatusDetailRerun;
  job: StatusDetailJobPayload | null;
  eventsPayload: StatusDetailEventsPayload | null;
  finishedAtFallback: string;
};

export type StatusDetailTranslationQuery = {
  finalStatus: string;
  q: string;
  limit: number;
  offset: number;
};

/**
 * Translation diagnostic summary (nested summary bag + top-level extension fields).
 * TranslationSummary reads summary.summary.{status_summary,counts,provider_*}.
 */
export type StatusDetailTranslationSummaryInner = {
  status_summary?: Record<string, unknown>;
  final_status_counts?: Record<string, unknown>;
  counts?: Record<string, unknown>;
  provider_family?: string;
  provider?: string;
  [key: string]: unknown;
};

export type StatusDetailTranslationSummary = {
  summary?: StatusDetailTranslationSummaryInner | null;
  [key: string]: unknown;
} | null;

/** Item List row (TranslationItemsPanel) */
export type StatusDetailTranslationListItem = {
  item_id?: string;
  block_type?: string;
  classification_label?: string;
  source_preview?: string;
  source_text?: string;
  [key: string]: unknown;
};

/** Selected item detail (TranslationItemDetailPanel) */
export type StatusDetailTranslationSelectedItem = {
  item_id?: string;
  item?: StatusDetailTranslationListItem | null;
  page_number?: number | string;
  [key: string]: unknown;
} | null;

/** Replay result bag */
export type StatusDetailTranslationReplay = {
  payload?: {
    policy_before?: unknown;
    policy_after?: unknown;
    replay_result?: unknown;
    replay_error?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
} | null;

/** translation segment: createTranslationState mirror + UI loading/error */
export type StatusDetailTranslation = {
  jobId: string;
  loaded: boolean;
  summary: StatusDetailTranslationSummary;
  query: StatusDetailTranslationQuery;
  list: StatusDetailTranslationListItem[];
  total: number;
  selectedItemId: string;
  selectedItem: StatusDetailTranslationSelectedItem;
  replay: StatusDetailTranslationReplay;
  itemsLoading: boolean;
  itemDetailLoading: boolean;
  replayLoading: boolean;
  emptyMessage: string;
  itemsErrorText: string;
  itemErrorText: string;
  replayErrorText: string;
};

export type StatusDetailState = {
  overview: StatusDetailOverview;
  translation: StatusDetailTranslation;
  rerunPending: boolean;
};

export type StatusDetailActions = {
  setOverview: (
    state: StatusDetailState,
    overview?: Partial<StatusDetailOverview>,
  ) => StatusDetailState;
  resetOverview: (state: StatusDetailState) => StatusDetailState;
  setTranslation: (
    state: StatusDetailState,
    translation?: Partial<StatusDetailTranslation>,
  ) => StatusDetailState;
  resetTranslation: (state: StatusDetailState) => StatusDetailState;
  setRerunPending: (state: StatusDetailState, pending?: boolean) => StatusDetailState;
};

export type StatusDetailStore = Store<StatusDetailState, StatusDetailActions>;

const EMPTY_OVERVIEW: StatusDetailOverview = Object.freeze({
  headline: { iconMarkup: "", jobId: "-", note: "" },
  runtime: {
    currentStage: "-",
    stageElapsed: "-",
    totalElapsed: "-",
    retryCount: "0",
    lastTransition: "-",
    terminalReason: "-",
    inputProtocol: "-",
    stageSpecVersion: "-",
    mathMode: "-",
  },
  failure: {
    summary: "-",
    category: "-",
    stage: "-",
    rootCause: "-",
    suggestion: "-",
    lastLogLine: "-",
    retryable: "-",
  },
  rerun: { enabled: false, status: "" },
  job: null,
  eventsPayload: null,
  finishedAtFallback: "",
});

const EMPTY_TRANSLATION: StatusDetailTranslation = Object.freeze({
  jobId: "",
  loaded: false,
  summary: null,
  query: { finalStatus: "", q: "", limit: 20, offset: 0 },
  list: [],
  total: 0,
  selectedItemId: "",
  selectedItem: null,
  replay: null,
  itemsLoading: false,
  itemDetailLoading: false,
  replayLoading: false,
  emptyMessage: "",
  itemsErrorText: "",
  itemErrorText: "",
  replayErrorText: "",
});

export function createStatusDetailStore(): StatusDetailStore {
  return createStore<StatusDetailState, StatusDetailActions>({
    name: "statusDetail",
    initialState: {
      overview: EMPTY_OVERVIEW,
      translation: EMPTY_TRANSLATION,
      rerunPending: false,
    },
    actions: {
      setOverview(state, overview = {}) {
        return { ...state, overview: { ...state.overview, ...overview } };
      },
      resetOverview(state) {
        return { ...state, overview: EMPTY_OVERVIEW };
      },
      setTranslation(state, translation = {}) {
        return { ...state, translation: { ...state.translation, ...translation } };
      },
      resetTranslation(state) {
        return { ...state, translation: EMPTY_TRANSLATION };
      },
      setRerunPending(state, pending = false) {
        return { ...state, rerunPending: Boolean(pending) };
      },
    },
  });
}

export { EMPTY_OVERVIEW, EMPTY_TRANSLATION };



