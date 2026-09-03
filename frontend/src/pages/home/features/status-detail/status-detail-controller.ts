// StatusDetailDialog composition logic (blueprint §1 verdict table landing spot).
//
// Relationship with old-world features/status-detail/controller.js (key deviation, noted for report):
// controller.js's public return values are only { activateDetailTab, bindEvents,
// openStatusDetailDialog, buildDetailPageUrl, ensureTranslationData,
// syncRerunAction, ensureOverviewData } — applyFilter/changePage/loadItem/
// replay/rerunCurrentJob are all internal closures, reachable only through bindEvents()
// event-commands.js (document-delegated clicks, DOM Events-driven design). JSX components
// need to call these actions directly (controlled select/input, button onClick); this narrow
// public surface of "callbacks only accept DOM Events" is unworkable in the React world.
//
// Therefore this file does NOT import controller.js/translation-tab-port.js/
// event-commands.js/navigation-view-port.js/dialog-view-port.js/
// resume-view-port.js/translation-renderer.js/view.js (blueprint death list + all
// architecture-boundaries anti-rollback zone), instead directly composing the pure logic
// layers the blueprint verdict marks "keep": overview-coordinator.js / resume-actions.js /
// translation-data-port.js / translation-tab-coordinator.js / translation-state.js /
// snapshot.js — using its own viewPort/render* callbacks to write their output to
// status-detail-store.js, not assembling DOM markup. Each method re-exposed at the pages
// layer, JSX calls directly.

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

  // ---- resume/rerun (resume-actions.js kept; resumeViewPort switched to store-driven,
  //      no longer queries view.js's dialogComponent() DOM) ----
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

  // ---- overview (overview-coordinator.js kept; renderOverviewSnapshot lands on
  //      store, job/eventsPayload stores raw values — blueprint §1 verdict table: history.js/
  //      events.js markup assembly part not used, StageHistoryList/EventsList compute
  //      structured arrays from these two raw fields via pure functions) ----
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

  // ---- translation (translation-data-port.js + translation-tab-coordinator.js
  //      kept; render* callbacks changed to "shallow-copy translationState write to store" — store's
  //      translation segment is a mirror of this status bag, plus a small amount of pure UI state (*Loading/
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

  // ---- External unified entry point (blueprint §1: ResultActions.jsx's #status-detail-btn
  //      directly calls openStatusDetailDialog("overview"), not events) ----
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
    syncRerunAction,
  };
}

export type StatusDetailController = ReturnType<typeof createStatusDetailController>;


