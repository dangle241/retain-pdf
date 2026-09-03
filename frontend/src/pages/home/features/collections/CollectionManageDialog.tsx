// New / Manage collection dialog (one of the 10 new dialogs added after shadcn refactor,
// same pattern as the other 9: DialogPrimitive.Root/Portal/Overlay/Content +
// desktop-dialog/desktop-shell + useDialogReturnFocus).
//
// Interaction design referenced PDF_MD_lib's FolderManageModal (name input + select
// from library), simplified to single-column selection (no manual sort — not doing drag
// / sort this time; see research plan "things not to do").
//
// dialogStore.payload = CollectionRecord being edited, or null (new mode). open() called
// by CategoriesView.jsx. This dialog and CategoriesView are siblings under HomeApp.jsx
// (not parent-child), so after Save/Delete success there's no direct prop callback —
// relies on services.collections.reloadSignal (an extremely minimal store with only a
// version field) as a bridge: bump it once here, CategoriesView subscribes to the change
// and refetches the list.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size is inferred as required in unannotated source files; unstyled path doesn't use size at runtime.
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
    // Already has book data: soft refetch when switching edit target; avoids whole-table
    // loading flash leaving empty state visible
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
        setError(err?.message || "Failed to load documents. Please retry later.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });
    // After close, quickly reopens for another collection (e.g., first edit "Chemistry" then
    // edit "Machine Learning"). The two fetches' order of resolution is uncertain — without
    // this guard, the later-closing request, if it arrives late, would overwrite the already
    // displayed "Machine Learning" form back to "Chemistry"'s book data.
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
      setError("Please enter a collection name.");
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
      setError(err?.message || (isCreate ? "Failed to create collection. Please retry later." : "Failed to save collection. Please retry later."));
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
      setError(err?.message || "Failed to delete collection. Please retry later.");
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
                <h2>{isCreate ? "New collection" : "Manage collection"}</h2>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button id="collection-manage-close-btn" type="button" className="dialog-close-btn" aria-label="Close">×</button>
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
                  placeholder="e.g., Chemistry"
                  autoFocus
                />
              </label>
              <div className="collection-doc-picker">
                <p className="muted">Select books from the library to add to this collection</p>
                {loading ? (
                  <div className="collection-doc-list-empty">Loading documents...</div>
                ) : allDocuments.length === 0 ? (
                  <div className="collection-doc-list-empty">The library has no books yet</div>
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
                  {confirmingDelete ? "Confirm Delete?" : "Delete Collection"}
                </Button>
              ) : <span />}
              <Button
                id="collection-save-btn"
                className="app-button"
                disabled={saving || loading}
                onClick={handleSave}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}




