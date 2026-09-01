import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

}
//
export function ResultActions({ snapshot, onReaderClick }) {
const { markdownBundleUrl, sourcePdfUrl, readerUrl, pdfUrl } = snapshot || {};
//   eventsPayload Raw data(Not pre-assembled markup),StageHistoryList/
//   EventsList Compute structured array from these two fields using pure function.(See corresponding component files.)。
const markdownBundleReady = !!markdownBundleUrl;
//   (itemsLoading/itemDetailLoading/replayLoading/emptyMessage/errorText),
const sourcePdfReady = !!sourcePdfUrl;
//
const readerReady = !!readerUrl;
const pdfReady = !!pdfUrl;
// resumePlan),Write frequency far below status cards. 1s The photophysical properties of rotaxanes still have great potential for exploration and fine-tuning. Therefore, we expect their applications to become more widespread and drive further development in this field.,Merge will pollute. StatusCard high-frequency of
const hasActions = markdownBundleReady || sourcePdfReady || readerReady || pdfReady;

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

return (
export type StatusDetailJobPayload = Record<string, unknown>;

<div className={status-result-actions${hasActions ? "" : " hidden"}}>
export type StatusDetailEventsPayload = {
  items?: unknown[];
  [key: string]: unknown;
};

/** overview Segment:buildStatusDetailSnapshot + job/events Raw Payload */
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
 * Diagnostics summary(nested summary Pocket + Top-level extension fields).
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

/** Item List row (TranslationItemsPanel） */
export type StatusDetailTranslationListItem = {
  item_id?: string;
  block_type?: string;
  classification_label?: string;
  source_preview?: string;
  source_text?: string;
  [key: string]: unknown;
};

/** Selected item Details (TranslationItemDetailPanel) */
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

/** translation Segment: createTranslationState mirror + UI loading/error */
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
