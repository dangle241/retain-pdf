// Translate workflow dialog ââ Only "Add PDF" Upload entry point usage.
//
// Book task progress / Initiate translation moved to book details "Translation" Tab:
//   BookTranslationWorkflowPanel（#book-detail-status-section）
// Stop reusing existing document Move progress into this modal. selectJob has document_id Opens details on click.
//
// Dialog rendering layer (Phase C second batch, shadcn refactor): from bespoke <div role="dialog">
// replaced with radix-ui Dialog primitives (DialogPrimitive.Root/Portal/Overlay/Content).
// Compared to Phase C First batch (4 including CredentialsDialog, dialog-store.js factory + Singleton
// Disable semantics)Structural differences: 3,Explain one by one.:
//
// 1. Open/close state source not dialog-store.js factory, but bespoke createStore Wrapped
//    dialogStatePort({open,mode})——services.stores.dialog Snapshot. Do not modify this file.
//    Layer (Iron Rule), Render-only swap.
//
// 2. Two-state semantics (dialog.mode: UPLOAD/STATUS) Dialog *internal* state, not Radix
//    open/closeâmode Only affects title copy and statusMode/uploadMode two classes,
//    Orthogonal to this migration.,Keep as is.
//
// 3. Disable unified routing to requestClose(): Escape/Backdrop/Close button must execute all three trigger paths.
//    services.workflowDialog.requestClose() (see translation-workflow-dialog-
//    runtime.js),No bypass. Call direct. dialogStatePort.close()——3b library
//    Refresh pending/Restore (bindings.js) depends on closeTranslationWorkflow Event at document
//    Visible above,Walk only requestClose() only then dispatch this event.
//
//    requestClose() Now is "one-click direct close" (No longer the early two-stage approach: When status visible
//    first returnHomeDialog fails to close.) Two-stage rejected by user. (Click task progress
//    Ã Resets empty upload form, also stopPolling Reset task), Changed to Ã = Close;
//    Abort and reassign StatusCard "Cancel Task" Button responsible.
//
//    Escape Key still needs extra handling: This dialog has an independent document-level keydown listener
//    (runtime bindEvents, Event contract required. visible on document, Cannot delete), Already
//    call requestClose() If simultaneously let Radix Content onEscapeKeyDown follow default behavior
//    (trigger onOpenChange(false) â requestClose()), one Escape Triggers twice.
//    requestClose(), two closeTranslationWorkflow Events trigger bindings.js
//    Suspend/Recovery logic re-executed. Explicit here. onEscapeKeyDown={(e)=>e.preventDefault()}
//    Delegate Escape entirely to existing document Listener handlingâDismissableLayer keydown
//    attached at capture Stage. bindEvents attached at bubble stage, Former runs first and is
//    preventDefault(), Radix's own onDismiss Skipped, then bubble stage bindEvents
//    Trigger once normally. requestClose(),All three paths call exactly once.,No duplicates.
//
// 4. Do not forceMount Content (Same as other dialogs' decision, see use-dialog-return-focus.js
//    header commentâforceMount would make Radix modal Content internal hideOthers() side effect
//    Permanent on app startup). WorkflowPanel (Upload Form) and #status-section (3b
//    StatusCard)Unload with dialog close.openUpload() Always open
//    resetUploadSession(), No expectation to preserve upload state across open/close; job-runtime polling engine
//    Independent of React Mount lifecycle service (store driven, No dependencies StatusCard Mount),
//    Uninstall StatusCard Background polling unaffected.âEngine itself when task reaches terminal state. stopPolling, Close
//    Dialog won't miss persistent polling.
//
// <html> Level style hook (rootOpen class) outside React root, use effect Sync (On uninstall
// Cleanup), Keep static. Trigger button ("Add", in LibraryBottomBar) Cross-dialog
// Subtree,Radix Default. triggerRef Focus return mechanism failed, reused
// use-dialog-return-focus.js (same as CredentialsDialog and other precedents).

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { WorkflowPanel } from "./WorkflowPanel.jsx";
import { StatusCard } from "../status/StatusCard.jsx";
import {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";

export function TranslationWorkflowDialog() {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const statusArea = useStoreSnapshot(services.stores.statusArea);

  const open = Boolean(dialog.open);
  const statusMode = dialog.mode === TRANSLATION_WORKFLOW_MODES.STATUS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

// <html> Level style hook outside React root, use effect to sync (Cleanup on uninstall)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen, open);
    return () => root.classList.remove(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen);
  }, [open]);

  const contentClasses = [
    "translation-workflow-dialog",
    statusMode
      ? TRANSLATION_WORKFLOW_DIALOG.classes.statusMode
      : TRANSLATION_WORKFLOW_DIALOG.classes.uploadMode,
  ].join(" ");

  // Escape(See header comment point 3 Click, here only preventDefaultClose handled by existing document
// listener handling) / Backdrop click (DismissableLayer outside-click detection) / Close button
  // (DialogPrimitive.Close)All route to requestClose() two-stage close decision of
  // (Make state visible first. returnHomeotherwise actually close)do not call directly
// dialogStatePort/dialogStore close().
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.workflowDialog.requestClose();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="translation-workflow-overlay" />
        <DialogPrimitive.Content
          id={TRANSLATION_WORKFLOW_DIALOG.ids.dialog}
          className={contentClasses}
          data-open={TRANSLATION_WORKFLOW_DIALOG.datasetValues.open}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="desktop-shell translation-workflow-shell">
            <div className="translation-workflow-head">
              <div className="translation-workflow-head-copy">
                <DialogPrimitive.Title asChild>
                  <h2 id={TRANSLATION_WORKFLOW_DIALOG.ids.title}>
                    {statusMode
                      ? TRANSLATION_WORKFLOW_DIALOG.copy.statusTitle
                      : TRANSLATION_WORKFLOW_DIALOG.copy.uploadTitle}
                  </h2>
                </DialogPrimitive.Title>
                {!statusMode ? (
                  <DialogPrimitive.Description asChild>
                    <p id="translation-workflow-desc" className="translation-workflow-desc">
                      {TRANSLATION_WORKFLOW_DIALOG.copy.uploadDescription}
                    </p>
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  id={TRANSLATION_WORKFLOW_DIALOG.ids.closeButton}
                  type="button"
                  className="dialog-close-btn"
aria-label="Close"
                >
                  ×
                </button>
              </DialogPrimitive.Close>
            </div>
            <WorkflowPanel />
            <section
              id="status-section"
              className={`translation-status-panel${statusArea.visible ? "" : " hidden"}`}
aria-label="Task Progress"
            >
              {/* status 侧 props default values tightened in another batch;Complete call site to match current signature. */}
              <StatusCard
                visible={statusArea.visible}
                showResultActions
                showHiddenContract
                rootId="job-status-card"
              />
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
