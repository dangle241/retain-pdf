// Create/Manage collection dialog(shadcn Newly added after refactoring 10 dialog,and rest 9 Same set
// path:DialogPrimitive.Root/Portal/Overlay/Content + desktop-dialog/
// desktop-shell + useDialogReturnFocus)。
//
// Interaction reference project PDF_MD_lib FolderManageModal(Name input + Select from library),
// Simplify to single-column checkboxes(No manual sortingâNo drag support this time/Sorting, See research plan "Exclusions").
//
// dialogStore.payload = Editing CollectionRecord, or null(New Mode).
// open() called by CategoriesView.jsx. This dialog and CategoriesView are HomeApp.jsx
// Sibling nodes below(Not parent-child), Save/Cannot proceed directly after successful deletion. prop Callback.
// services.collections.reloadSignal(Only one version Field minimalism store) bridge,
// Bump once here, CategoriesView refetch list upon change subscription.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size inferred as required in unannotated source; unstyled path does not use size at runtime.
const Button = ButtonBase as any;
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";

export function CollectionManageDialog() {
  const services = useHomeServices();
  const { controller, dialogStore, reloadSignal } = services.collections;
  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const editing = dialogState.payload;
  const isCreate = !editing;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  const [name, setName] = useState("");
  const [allDocuments, setAllDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [originalIds, setOriginalIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      return undefined;
    }
    let cancelled = false;
    setError("");
    setName(editing?.name || "");
    // When bibliographic data exists soft Re-pull (switch edit target). Don't rebuild the table. loading Sky Flash
    setLoading((prev) => (allDocuments.length === 0 ? true : prev));
    const documentsPromise = controller.listAllDocuments();
    const memberIdsPromise = editing
      ? controller.listCollectionDocumentIds(editing.collection_id)
      : Promise.resolve([]);
    Promise.all([documentsPromise, memberIdsPromise])
      .then(([documents, memberIds]) => {
        if (cancelled) {
          return;
        }
        setAllDocuments(documents);
        setSelectedIds(memberIds);
        setOriginalIds(memberIds);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err?.message || "Failed to load book list. Please try again later.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });
// Reopen quickly for another collection after closing(Edit first "Chemistry" Edit again "Machine Learning"),
    // Twice fetch Who first resolve Uncertain——Without this guard,Last closed request
// If late, will display already visible "Machine Learning" form overlay back with "Chemistry" bibliographic data.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.collection_id]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  function toggleDocument(documentId) {
    setSelectedIds((prev) => (prev.includes(documentId)
      ? prev.filter((id) => id !== documentId)
      : [...prev, documentId]));
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter collection name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let collectionId = editing?.collection_id || "";
      if (isCreate) {
        const created = await controller.createCollection({ name: trimmed }) as {
          collection_id?: string;
        };
        collectionId = created.collection_id || "";
      } else if (trimmed !== editing.name) {
        await controller.patchCollection(collectionId, { name: trimmed });
      }
      const toAdd = selectedIds.filter((id) => !originalIds.includes(id));
      const toRemove = originalIds.filter((id) => !selectedIds.includes(id));
      if (toAdd.length) {
        await controller.addDocuments(collectionId, toAdd);
      }
      for (const documentId of toRemove) {
        await controller.removeDocument(collectionId, documentId);
      }
      reloadSignal.actions.bump();
      dialogStore.close();
    } catch (err) {
      setError(err?.message || (isCreate ? "Failed to create collection. Try again later." : "Save failed. Try again later."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await controller.deleteCollection(editing.collection_id);
      reloadSignal.actions.bump();
      dialogStore.close();
    } catch (err) {
      setError(err?.message || "Failed to delete collection. Please try again later.");
      setSaving(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id="collection-manage-dialog"
          className="desktop-dialog collection-manage-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <DialogPrimitive.Title asChild>
                <h2>{isCreate ? "New Collection" : "管理合集"}</h2>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
<button id="collection-manage-close-btn" type="button" className="dialog-close-btn" aria-label="Close">Ã</button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body collection-manage-body">
              <label className="collection-name-field">
<span>Name</span>
                <input
                  id="collection-name-input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Chemistry"
                  autoFocus
                />
              </label>
              <div className="collection-doc-picker">
                <p className="muted">Select books from library to add to this collection.</p>
                {loading ? (
                  <div className="collection-doc-list-empty">Loading bibliography…</div>
                ) : allDocuments.length === 0 ? (
                  <div className="collection-doc-list-empty">No books in library</div>
                ) : (
                  <ul className="collection-doc-list">
                    {allDocuments.map((doc) => (
                      <li key={doc.document_id}>
                        <label className="collection-doc-item">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(doc.document_id)}
                            onChange={() => toggleDocument(doc.document_id)}
                          />
                          <span className="collection-doc-title" title={doc.title}>{doc.title || doc.source_filename}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {error ? <p className="collection-manage-error">{error}</p> : null}
            </div>
            <div className="collection-manage-actions">
              {!isCreate ? (
                <Button
                  id="collection-delete-btn"
                  className={`app-button secondary danger${confirmingDelete ? " is-confirming" : ""}`}
                  disabled={saving}
                  onClick={handleDelete}
                >
                  {confirmingDelete ? "Confirm deletion?" : "Delete Collection"}
                </Button>
              ) : <span />}
              <Button
                id="collection-save-btn"
                className="app-button"
                disabled={saving || loading}
                onClick={handleSave}
              >
                {saving ? "Saving...…" : "保存"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
