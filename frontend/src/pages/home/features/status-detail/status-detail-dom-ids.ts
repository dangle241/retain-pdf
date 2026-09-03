// StatusDetailDialog DOM contract ID copy (blueprint §1 + §0.1).
//
// Copied from src/js/components/dialogs/status-detail-dialog-dom-contract.js (that
// directory is the old custom element View layer; architecture-boundaries.test.mjs's
// `/js/components/` anti-bounce regex prohibits pages/** direct imports) —
// CredentialsDialog domain already used the same approach to produce
// credentials-dom-ids.js, and this follows the same pattern. ID strings are
// preserved one-by-one; visual baselines (status-dialog-failed/status-dialog-translation)
// and gate assertions depend on these IDs, so renaming any old-world string is
// forbidden for new/changed work.

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

// Copied from src/js/contracts/download-action-contract.js MARKDOWN_BUNDLE id
// (that file is not in an anti-bounce restricted zone; but the id for the
// Overview panel download row belongs to StatusDetailDialog's own template
// contract — it is a different physical id from status-card-dom-ids.js's
// STATUS_MARKDOWN_BUNDLE, so no conflict — inline it to avoid an extra re-export).
export const STATUS_DETAIL_MARKDOWN_BUNDLE_ID = "markdown-bundle-btn";

