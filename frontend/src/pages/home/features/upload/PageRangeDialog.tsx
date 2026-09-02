// Professional translation dialog (React version of <page-range-dialog>, side-by-side with components/dialogs/page-range-dialog.js).
//
// Dialog rendering layer (Stage C final batches, shadcn refactor): switch from native <dialog>+showModal/close
// to radix-ui Dialog primitives (DialogPrimitive.Root/Portal/Overlay/Content),
// keeping the existing desktop-dialog/desktop-shell visual system without default skin.
// Open/close state still uses the uploadView store's pageRangeDialogOpen field (rule: no store changes, only rendering layer),
// onOpenChange(false) uniformly goes through uploadViewActions.patch to write back.
//
// Fixed a real bug (recorded in blueprint, known leftover mentioned in commit d238471):
// backdrop click originally triggered uploadFeature.applyPageRanges() (equivalent to "confirm apply"), while Escape
// took another path that only cleared the pageRangeDialogOpen flag without applying — two close methods for the same dialog
// with inconsistent semantics, and violating the convention used by the other 8 dialogs where "backdrop/Esc/Close button = pure close".
// Here unified to pure-close semantics: all three close methods (backdrop click via Radix onPointerDownOutside/outside-click,
// Esc, Close button DialogPrimitive.Close) only patch pageRangeDialogOpen:false without triggering any apply side effects.
//
// Confirmed this does not cause tool loss: reading upload/controller.js#applyPageRanges shows its entire implementation
// is viewPort.closePageRangeDialog() — this dialog no longer has independent "confirm to submit" fields
// (page range is read/written directly in the upload area inputs, glossary select is also <select onChange> writing directly to store,
// both take effect live without this dialog gating). In other words, apply and "pure close" are effectively the same thing
// in the current implementation; unifying semantics does not lose any user-reachable action path: the dialog's "Done" button
// (#page-range-apply-btn) remains, with the same effect as backdrop click/Esc.
//
// Glossary dropdown is driven by workflow store's glossaries/selectedGlossaryId
// (mirrors workflow/view.js setDeveloperGlossaryOptions selection semantics, including
// "Deleted or not ready" fallback items).
//
// Trigger button (HeroUpload.jsx #page-range-btn) and dialog are across subtrees, so Radix's default
// triggerRef focus return fails; reuse use-dialog-return-focus.js (same precedent as the other 8 dialogs).

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

  // Esc / backdrop click / Close button all go through this callback to write back to store, pure close, no apply side effects.
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
                  <h2 id="page-range-title">Professional Translation</h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <button id="page-range-close-btn" type="button" className="dialog-close-btn" aria-label="Close">×</button>
                </DialogPrimitive.Close>
              </div>
              <div className="desktop-body">
                <p id="page-range-limit-text" className="muted">Select the glossary to use for this translation. Page scope can be filled directly in the upload area.</p>
                <label className="professional-glossary-field">
                  <span>Glossary</span>
                  <select
                    id="job-glossary-id"
                    value={selectedId}
                    onChange={(event) => services.workflowViewActions.setSelectedGlossaryId(event.target.value)}
                  >
                    <option value="">No glossary</option>
                    {workflow.glossaries.map((glossary) => (
                      <option key={glossary.glossaryId} value={glossary.glossaryId}>
                        {glossary.name}
                        {Number.isFinite(glossary.entryCount) ? ` (${glossary.entryCount})` : ""}
                      </option>
                    ))}
                    {!hasSelected ? (
                      <option value={selectedId}>{`Deleted or not ready: ${selectedId}`}</option>
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
                    Clear
                  </button>
                  <button
                    id="page-range-apply-btn"
                    type="button"
                    className="app-button"
                    onClick={() => services.features.uploadFeature?.applyPageRanges()}
                  >
                    Done
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





