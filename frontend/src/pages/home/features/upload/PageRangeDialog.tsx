// Professional translation dialog (React version of <page-range-dialog>, reference components/dialogs/page-range-dialog.js).
//
// Dialog render layer (Phase C final batch, shadcn refactor): from native <dialog>+showModal/close
// to radix-ui Dialog primitives (DialogPrimitive.Root/Portal/Overlay/Content),
// Continue to use existing desktop-dialog/desktop-shell Visual system,No default skin. Open/close state.
// Still using uploadView store pageRangeDialogOpen field (Iron law: No changes to store, Replace only
// Render layer), onOpenChange(false) uniformly uses uploadViewActions.patch Write back.
//
// Real bug fix (Blueprint already recorded. commit d238471 Known legacy issue, previously mentioned.): backdrop click
// Originally triggered by uploadFeature.applyPageRanges()(Equivalent to"Confirm application"),Escape
// goes pageRangeDialogOpen Flags & Excluded Paths——Same dialog
// Two close methods have inconsistent semantics, and the other 8 dialogs "Backplane/Esc/Close buttons perform pure close"
// Violates contract. Unify to pure close semantics.: Three close methods (Click backplane to proceed. Radix's
// onPointerDownOutside/outside-click Detect, Esc, Close button DialogPrimitive.Close)
// only all patch pageRangeDialogOpen:false,No application side effects.
//
// Confirmed: no functional regression.: read upload/controller.js#applyPageRanges Its
// Full implementation viewPort.closePageRangeDialog()——this dialog has long had no independent
// "Submit only after confirmation."fields(Input page range directly in upload area field.,Glossary selection too
// <select onChange> writes directly to store, both take effect immediately, (Bypass dialog validation). also
// That is to say apply and "Pure close" are the same thing in current implementation. Unify semantics. Preserve all meaning.
// User-accessible operation paths: Inside dialog "Complete" button (#page-range-apply-btn) still present,
// Effect is identical to backdrop click/Esc.
//
// Glossary dropdown driven by workflow store glossaries/selectedGlossaryId
// (Mirror workflow/view.js setDeveloperGlossaryOptions Option semantics, including
// 「Deleted or unavailable」Fallback item)。
//
// Trigger button (HeroUpload.jsx #page-range-btn) Cross-subtree with this dialog, Radix default
// triggerRef focus return fails, Reuse use-dialog-return-focus.js (Same as other 8
// dialog precedents).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";

export function PageRangeDialog() {
  const services = useHomeServices();
  const upload = useStoreSnapshot(services.stores.uploadView);
  const workflow = useStoreSnapshot(services.stores.workflowView);

  const open = Boolean(upload.pageRangeDialogOpen);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

// Esc / backdrop click / close button all use this single callback to write back to store, pure close, No app side effects.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.uploadViewActions.patch({ pageRangeDialogOpen: false });
    }
  }

  const selectedId = `${workflow.selectedGlossaryId || ""}`.trim();
  const hasSelected = !selectedId
    || workflow.glossaries.some((glossary) => glossary.glossaryId === selectedId);

  return (
    <page-range-dialog data-hydrated="1">
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
          <DialogPrimitive.Content
            id="page-range-dialog"
            className="desktop-dialog page-range-dialog professional-translate-dialog"
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="desktop-shell">
              <div className="desktop-head">
                <DialogPrimitive.Title asChild>
                  <h2 id="page-range-title">Professional translation</h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
<button id="page-range-close-btn" type="button" className="dialog-close-btn" aria-label="Close">Ã</button>
                </DialogPrimitive.Close>
              </div>
              <div className="desktop-body">
                <p id="page-range-limit-text" className="muted">Select the glossary to use for this translation. Page ranges can be filled directly in the upload area.</p>
                <label className="professional-glossary-field">
<span>Glossary</span>
                  <select
                    id="job-glossary-id"
                    value={selectedId}
                    onChange={(event) => services.workflowViewActions.setSelectedGlossaryId(event.target.value)}
                  >
                    <option value="">No glossary used.</option>
                    {workflow.glossaries.map((glossary) => (
                      <option key={glossary.glossaryId} value={glossary.glossaryId}>
                        {glossary.name}
                        {Number.isFinite(glossary.entryCount) ? ` (${glossary.entryCount})` : ""}
                      </option>
                    ))}
                    {!hasSelected ? (
                      <option value={selectedId}>{`Deleted or unavailable.: ${selectedId}`}</option>
                    ) : null}
                  </select>
                </label>
                <div className="actions">
                  <button
                    id="page-range-clear-btn"
                    type="button"
                    className="app-button secondary"
                    onClick={() => services.features.uploadFeature?.clearPageRanges()}
                  >
                    Do not use
                  </button>
                  <button
                    id="page-range-apply-btn"
                    type="button"
                    className="app-button"
                    onClick={() => services.features.uploadFeature?.applyPageRanges()}
                  >
Complete
                  </button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </page-range-dialog>
  );
}
