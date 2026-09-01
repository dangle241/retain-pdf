import {
  APP_EVENTS,
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";
import type { TranslationWorkflowDialogStatePort } from "../../composition/external.js";

// Translation workflow dialog runtime (React World edition controller).
//
// Reuse Pure Logic: dialogStatePort in state.js (store drives open/close/mode, Sync home
// viewMode)、contract.js mode constants,status-area-port Legacy Contract controller.js
// DOM Binding (dialogElement/closeButton addEventListener) replaced by React component
// onClick Replace,Only keep this here. document Level event bridge.
//
// Event contract (Blueprint Risk 5, Indestructible):
// - User-side toggle entry (Add button / Close button / Backdrop / Escape) Always first dispatch
//   APP_EVENTS.openTranslationWorkflow / closeTranslationWorkflow,Re-derive from this.
// runtime document Listen for unified landing stateâ3b recent-jobs Library refresh hangs/Restore.
// (bindings.js) and app-actions Submission flow depends on these two events. document Visible above.
// - translationWorkflowSync / statusAreaVisibilityChanged → Sync mode.

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
// 3b Fix (Empirical findings, Not pre-designed.): recent-jobs refresh-environment.js
// By default isWorkflowOpen reads #translation-workflow-dialog data-open
// attribute (DOM), Not any storeâwhereas React DOM Submit relative store Writes are async.
// close() triggered by "store write â bindings.js closeTranslationWorkflow Listener"
// Read DOM Determine isSuspended() "All occur within same synchronous event dispatch call stack., At this time React
  // hasn't had time to re-render and commit the new data-open,DOM still reads the old value from before opening——Reproduced in testing as
// "Library refresh hangs indefinitely after closing workflow dialog." (Blueprint Risk 5 Specific failure mode).
// mountRecentJobsFeature Not open environment injection entry (see composition.js
// description), Cannot inject read from upstream. store isWorkflowOpen, Reverse only: during store write
  // same beat,Sync this property too. DOM,Remove DOM reader's race window.
// React Rerenders same value later at own pace. (Idempotent, no side effects).
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

// ---- State persisted (document Listen for invocation; mirror old controller openUpload/openFromEvent/close/sync) ----

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

  // ---- User-side entry(React Component invocation;Emit events only,Do not modify state directly) ----

  function dispatch(eventName: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
    }
  }

  function requestOpenUpload() {
    dispatch(APP_EVENTS.openTranslationWorkflow, { mode: TRANSLATION_WORKFLOW_MODES.UPLOAD });
  }

// Close = Close dialog directly, One-click positioning (Regardless of current upload or task progress state).
  //
// Old "Two-stage shutdown" (When state is visible, first returnHome, dialog stays open, Click again to close) was
// User deemed non-compliant: clicking task progress Ã Bounces back first to "Translate PDF" Empty upload form, also
  // Silently stopPolling Reset task,Looks like"Closing reverts to previous step"Now unify to"× =
// Close "Cancel running tasks: StatusCard Go to Dedicated "Cancel Task" button
  // (cancelCurrentJob),Do not rely on closing the dialog to perform this task.
  //
  // Closing does not affect background tasks.:job-runtime Polling independent of dialog mount lifecycle,Task reached final state.
// when controller.js Self-executes. pollingPort.stop() (see this file Â§renderJob), Won't because
  // Closing dialog leaks persistent poller.;Library grid cards still show real-time task progress.
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
