// Translation workflow dialog — used only for the "Add PDF" upload entry.
//
// Job Progress / Start translation has moved to Book Details "Translation" tab:
//   BookTranslationWorkflowPanel(#book-detail-status-section)
// Do not move existing document progress into this dialog anymore; when selectJob
// has document_id it will open the details directly.
//
// Dialog rendering layer (Stage C batch 2, shadcn refactor):
// Replaced bespoke <div role="dialog"> with radix-ui Dialog primitives
// (DialogPrimitive.Root/Portal/Overlay/Content).
// Compared to Stage C batch 1 (CredentialsDialog and 3 others, dialog-store.js factory
// + singleton Close semantics), there are three structural differences, explained below:
//
// 1. Open/close status source is not dialog-store.js factory, but a bespoke createStore wrapper
//    around dialogStatePort({open,mode}) — a snapshot of services.stores.dialog.
//    booksFiles does not touch this layer (hard rule), only the rendering changed.
//
// 2. Two-mode semantics (dialog.mode: UPLOAD/STATUS) are the dialog's *internal* status,
//    not Radix's open/close — mode only affects the title text and statusMode/uploadMode
//    classes, orthogonal to the books migration, preserved as-is.
//
// 3. Close unified to requestClose(): Escape / backdrop / Close button three entry paths
//    must all go through services.workflowDialog.requestClose() (see translation-workflow-
//    dialog-runtime.js), no single entry may bypass it and call dialogStatePort.close() directly.
//    The batch 3 library refresh suspend/resume (bindings.js) depends on closeTranslationWorkflow
//    events being visible on document, only requestClose() dispatches these events.
//
//    requestClose() is now "one click = direct close" (no longer the early two-phase:
//    when Status is visible first returnHome, dialog stays open). The two-phase was
//    judged by users as unexpected (clicking × on Job Progress would pop back to empty
//    Upload form, and also silently stopPolling to reset the job). Changed to × = Close;
//    canceling the job is now handled by the StatusCard's "Cancel job" button.
//
//    Escape key still needs extra handling: this dialog has a separate document-level
//    keydown listener (runtime's bindEvents; the event contract requires it to be visible
//    on document, cannot delete). It already calls requestClose(). If Radix Content's
//    onEscapeKeyDown also runs the default behavior (triggers onOpenChange(false) →
//    requestClose()), one Escape would trigger requestClose() twice, and two
//    closeTranslationWorkflow events would cause bindings.js suspend/resume logic
//    to run twice. Here we explicitly set onEscapeKeyDown={(e)=>e.preventDefault()}
//    to hand Escape completely to the existing document listener — DismissableLayer's
//    keydown is on capture phase, bindEvents on bubble phase; the former runs first
//    and we preventDefault(), Radix's own onDismiss is skipped, then bubble phase
//    bindEvents normally triggers requestClose() once. All three entry paths end up
//    calling exactly once, no duplicates.
//
// 4. No forceMount Content (same decision as other dialogs, see use-dialog-return-focus.js
//    header — forceMount causes Radix modal Content's hideOthers() side effect to
//    permanently take effect at app Start). WorkflowPanel (Upload form) and #status-section
//    (batch 3 StatusCard) therefore unmount together with the dialog close. openUpload()
//    resets on every open, no expectation of preserving Upload state across open/close;
//    job-runtime polling engine is independent of React mount lifecycle (store-driven,
//    does not depend on StatusCard mount/unmount). Unmounting StatusCard does not affect
//    background polling — when the job reaches its final state the engine stopsPolling
//    on its own, closing the dialog will not miss any standing polling.
//
// <html> level style hook (rootOpen class) is outside React root, uses effect sync
// (cleanup on unmount), left unchanged. The trigger button ("Add", in LibraryBottomBar)
// and this dialog are across subtrees, Radix's default triggerRef focus-return
// mechanism is ineffective, reusing use-dialog-return-focus.js (same precedent as
// CredentialsDialog and others).

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

  // <html> level style hook is outside React root, uses effect sync (cleanup on unmount)
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

  // Escape (see header comment page 3 point — only preventDefault here; actual close
  // handled by existing document listener) / backdrop click (DismissableLayer's
  // outside-click detection) / Close button (DialogPrimitive.Close) all ultimately
  // route to requestClose()'s two-phase close check (when Status is visible first
  // returnHome, only then actually close), do not call
  // dialogStatePort/dialogStore's close() directly.
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
              aria-label="Job Progress"
            >
              {/* status side props defaults tightened in another batch; fill call site here to satisfy current signature */}
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


