// GlossariesDialog (bản React <glossary-manager-dialog>, đối chiếu
// components/dialogs/glossary-manager-dialog-template.js phản chiếu từng id +
// điều phối đóng/mở/đọc/lưu của features/glossaries/controller.js được giữ).
//
// Lớp kết xuất Dialog (giai đoạn C, chuyển đổi shadcn): chuyển từ <dialog> gốc + showModal/close sang
// primitive Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content), không qua
// lớp giao diện mặc định src/components/ui/dialog.jsx; className tiếp tục dùng
// Bộ CSS riêng desktop-dialog/desktop-shell/glossary-manager-*. open được kiểm soát
// bởi glossariesDialogStore (open từ useGlossariesController); onOpenChange
// gọi thống nhất dialogStore.close() khi next===false; Escape, bấm nền và bấm nút đóng
// đều đi qua callback này, không cần listener handleBackdropClick/keydown viết tay.
//
// Không forceMount Content/Overlay, cùng kết luận với chú thích đầu CredentialsDialog.jsx: effect
// hideOthers(content) trong Radix modal Content phụ thuộc vòng đời mount/unmount thật;
// forceMount khiến nó có hiệu lực vĩnh viễn dù hộp thoại chưa mở, tạo lỗi trợ năng
// mới. Trường danh sách/trình sửa thuật ngữ đều do glossariesStore kiểm soát, không phải state cục bộ,
// nên gỡ Content khi đóng không mất dữ liệu; open() của controller.js khi mở lại sẽ
// reloadGlossaries() để điền lại, ngữ nghĩa không đổi.
//
// Entry mở: #glossary-btn trong tab "Thuật ngữ" của SettingsHubDialog gọi
// services.glossaries.dialogStore.open() (bản thiết kế §0.4); effect chuyển trạng thái open trong thành phần
// (xem useGlossariesController.js) nối lần mở này lại với
// open() của controller.js để khôi phục ngữ nghĩa cũ "mở là làm mới danh sách".

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { useGlossariesController } from "./useGlossariesController.js";
import { GlossaryList } from "./GlossaryList.jsx";
import { GlossaryEditor } from "./GlossaryEditor.jsx";
import { GlossaryImportPanel } from "./GlossaryImportPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size bị suy ra là bắt buộc trong tệp nguồn chưa chú kiểu; luồng unstyled không dùng size ở runtime.
const Button = ButtonBase as any;

export function GlossariesDialog() {
  const { open, view, store: glossariesStore, dialogStore, handlers } = useGlossariesController();
  // view.store trong HomeServices vẫn là generic AppStore mặc định; runtime có đầy đủ actions.
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
                  <h2>Bảng thuật ngữ</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  id={GLOSSARY_DOM_IDS.closeButton}
                  className="dialog-close-btn"
                  aria-label="Đóng"
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
                  <span>Tên</span>
                  <input
                    id={GLOSSARY_DOM_IDS.nameInput}
                    type="text"
                    autoComplete="off"
                    placeholder="Ví dụ: Thuật ngữ hóa học lượng tử"
                    value={view.draft.name}
                    onChange={(event) => store.actions.setName(event.target.value)}
                  />
                </label>
                <div className="glossary-toolbar">
                  <Button id={GLOSSARY_DOM_IDS.addRowButton} className="app-button secondary" onClick={() => handlers?.addRow?.()}>Thêm</Button>
                  <Button id={GLOSSARY_DOM_IDS.importButton} className="app-button secondary" onClick={() => handlers?.showImport?.()}>CSV</Button>
                  <Button id={GLOSSARY_DOM_IDS.exportButton} className="app-button secondary" onClick={() => handlers?.exportCurrent?.()}>Xuất</Button>
                  <Button id={GLOSSARY_DOM_IDS.deleteButton} className="app-button secondary danger" onClick={() => handlers?.deleteCurrent?.()}>Xóa</Button>
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
                  <Button id={GLOSSARY_DOM_IDS.saveButton} className="app-button" onClick={() => handlers?.save?.()}>Lưu</Button>
                </div>
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
