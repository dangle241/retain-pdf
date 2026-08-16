// Hộp thoại tạo/quản lý bộ sưu tập (hộp thoại thứ 10 thêm sau chuyển shadcn, cùng bộ với 9 hộp thoại còn lại
// theo luồng DialogPrimitive.Root/Portal/Overlay/Content + desktop-dialog/
// desktop-shell + useDialogReturnFocus)。
//
// Tương tác tham khảo FolderManageModal của dự án PDF_MD_lib (nhập tên + chọn từ thư viện),
// đơn giản thành chọn một cột; không sắp xếp thủ công, kéo/thả hay sắp xếp trong lần này.
//
// dialogStore.payload = CollectionRecord đang sửa hoặc null trong chế độ tạo mới.
// open() được CategoriesView.jsx gọi. Hộp thoại này và CategoriesView là các nút anh em trong HomeApp.jsx
// chứ không phải cha con; sau khi lưu/xóa thành công không thể callback trực tiếp qua prop nên dùng
// services.collections.reloadSignal (store tối giản chỉ có version) làm bridge,
// bump một lần tại đây để CategoriesView đăng ký thay đổi và tải lại danh sách.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size bị suy ra là bắt buộc trong tệp nguồn chưa chú kiểu; luồng unstyled không dùng size ở runtime.
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
    // Khi đã có dữ liệu sách, tải lại soft lúc đổi mục sửa, không làm cả bảng nháy trống vì loading.
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
        setError(err?.message || "Không thể tải danh mục sách, vui lòng thử lại sau.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });
    // Sau khi đóng rồi nhanh chóng mở cho bộ sưu tập khác (ví dụ sửa "Hóa học" rồi "Học máy"),
    // Không xác định lần fetch nào resolve trước; nếu thiếu guard này, yêu cầu của lần đóng sau
    // nếu tới muộn sẽ ghi đè biểu mẫu đang hiển thị "Học máy" bằng dữ liệu sách của "Hóa học".
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
      setError("Vui lòng nhập tên bộ sưu tập.");
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
      setError(err?.message || (isCreate ? "Không thể tạo bộ sưu tập, vui lòng thử lại sau." : "Lưu thất bại, vui lòng thử lại sau."));
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
      setError(err?.message || "Không thể xóa bộ sưu tập, vui lòng thử lại sau.");
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
                <h2>{isCreate ? "Tạo bộ sưu tập" : "Quản lý bộ sưu tập"}</h2>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button id="collection-manage-close-btn" type="button" className="dialog-close-btn" aria-label="Đóng">×</button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body collection-manage-body">
              <label className="collection-name-field">
                <span>Tên</span>
                <input
                  id="collection-name-input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Hóa học"
                  autoFocus
                />
              </label>
              <div className="collection-doc-picker">
                <p className="muted">Chọn sách từ thư viện để thêm vào bộ sưu tập này</p>
                {loading ? (
                  <div className="collection-doc-list-empty">Đang tải danh mục sách…</div>
                ) : allDocuments.length === 0 ? (
                  <div className="collection-doc-list-empty">Thư viện chưa có sách</div>
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
                  {confirmingDelete ? "Xác nhận xóa?" : "Xóa bộ sưu tập"}
                </Button>
              ) : <span />}
              <Button
                id="collection-save-btn"
                className="app-button"
                disabled={saving || loading}
                onClick={handleSave}
              >
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
