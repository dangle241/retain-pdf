// GlossariesDialog (React version of <glossary-manager-dialog>, compare with
// components/dialogs/glossary-manager-dialog-template.js id-by-id mirror +
// features/glossaries/controller.js (kept controller) open/read/save orchestration).
//
// Dialog rendering layer (Phase C, shadcn refactor): replace native <dialog>+showModal/close with
// radix-ui Dialog primitives (DialogPrimitive.Root/Portal/Overlay/Content), bypassing
// src/components/ui/dialog.jsx default skin (className continues to use existing
// desktop-dialog/desktop-shell/glossary-manager-* bespoke CSS). open Controlled
// to glossariesDialogStore (useGlossariesController's open), onOpenChange when
// next===false uniformly calls dialogStore.close() ââ EscapeClick backdrop, click close
// All three button paths share this callback. No longer requires manual entry handleBackdropClick/keydown listeners.
//
// Do not forceMount Content/Overlay (same conclusion as CredentialsDialog.jsx header comment): Radix
// modal Content Internal hideOthers(content) effect Depends on real data mount/unmount
// lifecycle, forceMount permanently applies even if dialog never opened, creating new accessibility
// Bug. Vocabulary list/Editor fields controlled by glossariesStore(Non-component local state),
// Bug. Vocabulary list/Editor fields controlled by glossariesStore (Non-component local state),
// Content Uninstalling when dialog closes does not delete data. ââ controller.js open() on reopen
//
// will reloadGlossaries() to refill, semantics unchanged.
// Open Entry: SettingsHubDialog "Glossary" tab #glossary-btn Call
// services.glossaries.dialogStore.open() (Blueprint Â§0.4); Internal open state
// migration effect (see useGlossariesController.js) Reconnect this session. controller.js's

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { useGlossariesController } from "./useGlossariesController.js";
import { GlossaryList } from "./GlossaryList.jsx";
import { GlossaryEditor } from "./GlossaryEditor.jsx";
import { GlossaryImportPanel } from "./GlossaryImportPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size is inferred as required in unannotated source files; unstyled path doesn't use size at runtime.
const Button = ButtonBase as any;

export function GlossariesDialog() {
  const { open, view, store: glossariesStore, dialogStore, handlers } = useGlossariesController();
// view.store in HomeServices Still on AppStore Default generic; runtime actions Full
  const store = glossariesStore as unknown as {
    actions: {
      setName: (name: string) => unknown;
      updateEntryField: (payload: { index: number; field: string; value: unknown }) => unknown;
      removeEntryRow: (index: number) => unknown;
      setCsvText: (value: string) => unknown;
    };
  };
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const status = view.status || { message: "", tone: "" };
  const statusContent = `${status.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    status.tone === "valid" ? "is-valid" : "",
    status.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={GLOSSARY_DOM_IDS.dialog}
          className="desktop-dialog glossary-manager-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell glossary-manager-shell">
            <div className="desktop-head">
              <div className="credential-dialog-head">
                <DialogPrimitive.Title asChild>
<h2>Glossary</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  id={GLOSSARY_DOM_IDS.closeButton}
                  className="dialog-close-btn"
aria-label="Close"
                >
                  ×
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body glossary-manager-body">
              <GlossaryList
                items={view.items}
                selectedId={view.selectedId}
                onSelect={(glossaryId) => handlers?.selectGlossary?.(glossaryId)}
                onCreateNew={() => handlers?.createNew?.()}
              />

              <section className="glossary-editor-panel">
                <label className="glossary-name-field">
<span>Name</span>
                  <input
                    id={GLOSSARY_DOM_IDS.nameInput}
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. quantum chemistry terminology"
                    value={view.draft.name}
                    onChange={(event) => store.actions.setName(event.target.value)}
                  />
                </label>
                <div className="glossary-toolbar">
<Button id={GLOSSARY_DOM_IDS.addRowButton} className="app-button secondary" onClick={() => handlers?.addRow?.()}>Add</Button>
                  <Button id={GLOSSARY_DOM_IDS.importButton} className="app-button secondary" onClick={() => handlers?.showImport?.()}>CSV</Button>
                  <Button id={GLOSSARY_DOM_IDS.exportButton} className="app-button secondary" onClick={() => handlers?.exportCurrent?.()}>Export</Button>
<Button id={GLOSSARY_DOM_IDS.deleteButton} className="app-button secondary danger" onClick={() => handlers?.deleteCurrent?.()}>Delete</Button>
                </div>
                <div className="glossary-editor-scroll">
                  <GlossaryEditor
                    entries={view.draft.entries}
                    onFieldChange={(index, field, value) => store.actions.updateEntryField({ index, field, value })}
                    onRemoveRow={(index) => store.actions.removeEntryRow(index)}
                  />
                  <GlossaryImportPanel
                    visible={view.importVisible}
                    csvText={view.csvText}
                    onCsvTextChange={(value) => store.actions.setCsvText(value)}
                    onApply={() => handlers?.applyImport?.()}
                    onCancel={() => handlers?.hideImport?.()}
                  />
                </div>
                <div className="glossary-footer">
                  <span id={GLOSSARY_DOM_IDS.status} className={statusClasses}>{statusContent}</span>
<Button id={GLOSSARY_DOM_IDS.saveButton} className="app-button" onClick={() => handlers?.save?.()}>Save</Button>
                </div>
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
