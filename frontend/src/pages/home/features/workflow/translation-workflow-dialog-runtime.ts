import {
  APP_EVENTS,
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";
import type { TranslationWorkflowDialogStatePort } from "../../composition/external.js";

// Translation workflow dialog runtime (React world controller).
//
// Reuses pure logic: state.js dialogStatePort (store-driven open/close/mode, syncs home
// viewMode), contract.js mode constants, status-area-port contract. Old controller.js
// DOM bindings (dialogElement/closeButton addEventListener) replaced by React component
// onClick, here only the document-level event bridge remains.
//
// Event contract (blueprint risk 5, cannot break):
// - User-side open/close entries (Add button / Close button / backdrop / Escape) all first
//   dispatch APP_EVENTS.openTranslationWorkflow / closeTranslationWorkflow, then this
//   runtime's document listener settles the status — batch 3 recent-jobs library refresh
//   suspend/resume (bindings.js) and app-actions Workflow submission both depend on these
//   two events being visible on document.
// - translationWorkflowSync / statusAreaVisibilityChanged → sync mode.

export interface TranslationWorkflowStatusAreaPort {
  isVisible?: () => boolean;
  hide?: () => void;
  returnHome?: () => void;
}

export interface TranslationWorkflowUploadSessionPort {
  resetUploadSession?: () => void;
}

export interface CreateTranslationWorkflowDialogRuntimeOptions {
  dialogStatePort?: TranslationWorkflowDialogStatePort;
  statusAreaPort?: TranslationWorkflowStatusAreaPort;
  uploadSessionPort?: TranslationWorkflowUploadSessionPort | null;
  documentRef?: Document;
}

export interface OpenTranslationWorkflowEventDetail {
  mode?: string;
}

export type OpenTranslationWorkflowEventLike = Event | {
  detail?: OpenTranslationWorkflowEventDetail;
};

export function createTranslationWorkflowDialogRuntime({
  dialogStatePort,
  statusAreaPort,
  uploadSessionPort = null,
  documentRef = globalThis.document,
}: CreateTranslationWorkflowDialogRuntimeOptions = {}) {
  // Batch 3 fix (empirically found, not pre-designed): recent-jobs refresh-environment.js
  // default isWorkflowOpen reads the data-open attribute of
  // #translation-workflow-dialog (DOM), not any store — but React's DOM commit
  // is asynchronous relative to store writes. close() triggers "store write →
  // bindings.js closeTranslationWorkflow listener reads DOM to determine isSuspended"
  // all happen in the same syncEvents dispatch call stack, at which point React
  // has not yet re-rendered and committed the new data-open — DOM still reads
  // the old value from before open. Reproduction: "After closing the workflow
  // dialog, the library refresh permanently freezes" (concrete failure mode of
  // blueprint risk 5).
  // mountRecentJobsFeature does not expose an environment injection point (see
  // composition.js notes), cannot inject a store-reading isWorkflowOpen from upstream,
  // so the only option: in the same tick as store write, also sync write this
  // attribute to DOM, eliminating the race window for DOM readers.
  // React will still re-render at its own pace with the same value (idempotent, no side effects).
  function syncOpenAttributeToDom(open: boolean) {
    const dialogEl = documentRef?.getElementById?.(TRANSLATION_WORKFLOW_DIALOG.ids.dialog);
    if (dialogEl?.dataset) {
      dialogEl.dataset.open = open
        ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
        : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed;
    }
  }
  function resolveMode(mode?: string) {
    if (mode === TRANSLATION_WORKFLOW_MODES.STATUS || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      return mode;
    }
    return statusAreaPort?.isVisible?.()
      ? TRANSLATION_WORKFLOW_MODES.STATUS
      : TRANSLATION_WORKFLOW_MODES.UPLOAD;
  }

  function isOpen() {
    return Boolean(dialogStatePort.getSnapshot().open);
  }

  // ---- Status landing (document listener calls; mirrors old controller's openUpload/openFromEvent/close/sync) ----

  function openUpload() {
    statusAreaPort?.hide?.();
    uploadSessionPort?.resetUploadSession?.();
    dialogStatePort.open(TRANSLATION_WORKFLOW_MODES.UPLOAD);
    syncOpenAttributeToDom(true);
  }

  function openFromEvent(event: OpenTranslationWorkflowEventLike = {} as OpenTranslationWorkflowEventLike) {
    const detail = (event as { detail?: OpenTranslationWorkflowEventDetail })?.detail;
    const mode = detail?.mode;
    if (!mode || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      openUpload();
      return;
    }
    dialogStatePort.open(resolveMode(mode));
    syncOpenAttributeToDom(true);
  }

  function close() {
    dialogStatePort.close();
    syncOpenAttributeToDom(false);
  }

  function sync() {
    dialogStatePort.setMode(resolveMode());
  }

  // ---- User-side entries (React component calls; only dispatch events, do not modify status directly) ----

  function dispatch(eventName: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
    }
  }

  function requestOpenUpload() {
    dispatch(APP_EVENTS.openTranslationWorkflow, { mode: TRANSLATION_WORKFLOW_MODES.UPLOAD });
  }

  // Close = directly close dialog, one click (regardless of whether current is Upload mode or Job Progress mode).
  //
  // Old "two-phase close" (when Status is visible first returnHome, dialog stays open,
  // click again to actually close) was judged by users as unexpected: clicking × on
  // Job Progress would first pop back to the "Translation PDF" empty Upload form,
  // and also silently stopPolling to reset the job, like "clicking Close actually
  // goes back one step". Now unified to "× = Close". To abort a running job there
  // is the dedicated "Cancel job" button on StatusCard (cancelCurrentJob), not
  // using the dialog close to double as this.
  //
  // Close does not affect background jobs: job-runtime polling is independent of
  // dialog mount lifecycle; when the job reaches its final state controller.js
  // will pollingPort.stop() on its own (see that file §renderJob), closing the
  // dialog will not miss any standing polling; LibraryGrid cards will still
  // display the job's live progress.
  function requestClose() {
    dispatch(APP_EVENTS.closeTranslationWorkflow);
  }

  function bindEvents() {
    if (!documentRef?.addEventListener) {
      return () => {};
    }
    const bindings: Array<[string, EventListener]> = [
      [APP_EVENTS.openTranslationWorkflow, openFromEvent as unknown as EventListener],
      [APP_EVENTS.closeTranslationWorkflow, close as EventListener],
      [APP_EVENTS.translationWorkflowSync, sync as EventListener],
      [APP_EVENTS.statusAreaVisibilityChanged, sync as EventListener],
    ];
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen()) {
        requestClose();
      }
    };
    bindings.forEach(([name, handler]) => documentRef.addEventListener(name, handler));
    documentRef.addEventListener("keydown", onKeydown);
    return () => {
      bindings.forEach(([name, handler]) => documentRef.removeEventListener(name, handler));
      documentRef.removeEventListener("keydown", onKeydown);
    };
  }

  return {
    bindEvents,
    close,
    isOpen,
    openFromEvent,
    openUpload,
    requestClose,
    requestOpenUpload,
    statePort: dialogStatePort,
    sync,
  };
}




