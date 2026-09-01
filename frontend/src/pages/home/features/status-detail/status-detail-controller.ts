// StatusDetailDialog combination logic of (Blueprint Â§1 Judgment table drop location).
//
// To the Old World features/status-detail/controller.js relationship with(Critical Deviation,Add to Report):
// controller.js Public return value only { activateDetailTab, bindEvents,
// openStatusDetailDialog, buildDetailPageUrl, ensureTranslationData,
// syncRerunAction, ensureOverviewData } —— applyFilter/changePage/loadItem/
// replay/rerunCurrentJob All internal closures,Only via bindEvents() Connected
// event-commands.js reach(document Delegate click,DOM Event-driven design)。JSX Component required
// Invoke actions directly (controlled select/inputButton onClick), this "Callback only recognizes DOM
// events" Narrow public surface area. React World infeasible.
//
// Thus this file does not import controller.js/translation-tab-port.js/
// event-commands.js/navigation-view-port.js/dialog-view-port.js/
// resume-view-port.js/translation-renderer.js/view.js(Blueprint kill checklist + All belong
// architecture-boundaries Anti-bounce dead zone), Directly compose blueprint judgment. "Retain" pure logic layer:
// overview-coordinator.js / resume-actions.js / translation-data-port.js /
// translation-tab-coordinator.js / translation-state.js / status-detail/
// snapshot.js —— Use own. viewPort/render* Callbacks write their output to
// status-detail-store.js,rather than concatenating DOM markupMethod by method. pages Reset Layer
// Expose,JSX Call directly.

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

// go through ReaderDialog unified openReaderRequested entry, href kept as
// JS fallback available on invalidation.
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

//
// markdownBundle/sourcePdf/pdf 3 download links (dialogs blueprint §7): these few id
// hit artifact-downloads domain document click delegated level (controller.js's
  //      Compute structured arrays from two raw fields using pure functions.) ----
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
// handleProtectedArtifactClick, composition.js mounted bindEvents()), click
// handler runs before native <a> default redirect executes. event.preventDefault() — button itself does not
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

// need extra onClick (delegate click. button renderer irrelevant.) subscribe only here
  //      openStatusDetailDialog("overview"),Not event dispatch) ----
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
