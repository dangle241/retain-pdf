// Hộp thoại workflow dịch; chỉ dùng cho điểm vào tải lên "Thêm PDF".
//
// Tiến độ tác vụ sách / bắt đầu dịch đã chuyển sang tab "Dịch" trong chi tiết sách:
//   BookTranslationWorkflowPanel（#book-detail-status-section）
// Không đưa tiến độ của document đã có vào hộp thoại này nữa; selectJob sẽ mở chi tiết khi có document_id.
//
// Tầng render Dialog (đợt hai giai đoạn C, chuyển đổi shadcn): từ <div role="dialog"> tùy chỉnh
// sang primitive Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content).
// So với đợt đầu giai đoạn C (CredentialsDialog và bốn hộp thoại khác, factory dialog-store.js + ngữ nghĩa đóng
// một trạng thái), cấu trúc có ba điểm khác nhau, giải thích lần lượt:
//
// 1. Nguồn trạng thái đóng/mở không phải factory dialog-store.js mà là
//    dialogStatePort({open,mode}) được bọc bằng createStore tùy chỉnh, tức snapshot services.stores.dialog. File này không sửa
//    tầng đó (nguyên tắc bắt buộc), chỉ thay render.
//
// 2. Ngữ nghĩa hai trạng thái (dialog.mode: UPLOAD/STATUS) là trạng thái *bên trong* hộp thoại, không phải
//    open/close của Radix; mode chỉ ảnh hưởng nội dung tiêu đề và hai lớp statusMode/uploadMode,
//    độc lập với lần chuyển đổi này nên giữ nguyên.
//
// 3. Việc đóng luôn định tuyến tới requestClose(): cả ba đường kích hoạt Escape/nền sau/nút đóng đều phải đi qua
//    services.workflowDialog.requestClose() (xem translation-workflow-dialog-
//    runtime.js), không đường nào được bỏ qua để gọi trực tiếp dialogStatePort.close(); việc tạm dừng/tiếp tục làm mới thư viện 3b
//    (bindings.js) phụ thuộc sự kiện closeTranslationWorkflow hiển thị trên document,
//    chỉ requestClose() mới dispatch sự kiện này.
//
//    requestClose() hiện là "bấm một lần để đóng trực tiếp" (không còn hai bước như trước: khi trạng thái hiển thị thì
//    returnHome trước nhưng không đóng hộp thoại). Người dùng đánh giá hai bước là trái kỳ vọng (bấm
//    × ở tiến độ tác vụ sẽ quay về biểu mẫu tải lên trống và còn stopPolling để đặt lại tác vụ), nên đã đổi thành × = đóng;
//    dừng tác vụ do nút "Hủy tác vụ" của StatusCard đảm nhiệm.
//
//    Phím Escape vẫn cần xử lý thêm: hộp thoại này có listener keydown cấp document độc lập
//    (bindEvents của runtime; hợp đồng sự kiện yêu cầu nó hiển thị trên document nên không thể xóa), đã
//    gọi requestClose(). Nếu đồng thời để onEscapeKeyDown của Radix Content dùng hành vi mặc định
//    (kích hoạt onOpenChange(false) → requestClose()), một lần Escape sẽ kích hoạt hai lần
//    requestClose(); hai sự kiện closeTranslationWorkflow sẽ khiến logic tạm dừng/tiếp tục trong bindings.js
//    chạy lặp. Tại đây đặt tường minh onEscapeKeyDown={(e)=>e.preventDefault()}
//    để giao Escape hoàn toàn cho listener document hiện có; keydown của DismissableLayer
//    gắn ở pha capture, bindEvents gắn ở pha bubble; phần trước chạy trước và được
//    preventDefault(), onDismiss của Radix bị bỏ qua, sau đó bindEvents ở pha bubble
//    kích hoạt requestClose() đúng một lần; cuối cùng cả ba đường đều gọi đúng một lần, không lặp.
//
// 4. Không forceMount Content (cùng quyết định với các hộp thoại còn lại; xem
//    comment đầu use-dialog-return-focus.js; forceMount sẽ khiến tác dụng phụ hideOthers() bên trong Content của Radix modal
//    có hiệu lực vĩnh viễn ngay khi ứng dụng khởi động). WorkflowPanel (biểu mẫu tải lên) và #status-section (3b
//    StatusCard) vì vậy unmount cùng khi hộp thoại đóng. openUpload() luôn
//    resetUploadSession() mỗi lần mở, không có kỳ vọng giữ trạng thái tải lên qua các lần đóng/mở; engine polling job-runtime
//    là dịch vụ độc lập với vòng đời mount React (do store điều khiển, không phụ thuộc StatusCard có mount hay không),
//    unmount StatusCard không ảnh hưởng polling nền; khi tác vụ tới trạng thái cuối, engine tự stopPolling; đóng
//    hộp thoại không làm mất polling thường trực.
//
// Hook kiểu dáng cấp <html> (lớp rootOpen) nằm ngoài gốc React, được đồng bộ bằng effect (
// dọn khi unmount), giữ nguyên. Nút kích hoạt ("Thêm" trong LibraryBottomBar) và hộp thoại này nằm ở các
// cây con khác nhau, cơ chế trả focus triggerRef mặc định của Radix không hoạt động nên tái sử dụng
// use-dialog-return-focus.js (cùng tiền lệ với CredentialsDialog và các hộp thoại khác).

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

  // Hook kiểu dáng cấp <html> nằm ngoài gốc React, đồng bộ bằng effect (dọn khi unmount).
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

  // Escape (xem điểm 3 trong comment đầu; tại đây chỉ preventDefault, việc đóng thực tế do listener document
  // hiện có xử lý) / bấm nền sau (phát hiện outside-click của DismissableLayer) / nút đóng
  // (DialogPrimitive.Close) cuối cùng đều định tuyến tới quyết định đóng hai bước của requestClose()
  // (nếu trạng thái hiển thị thì returnHome trước, nếu không mới thực sự close), không gọi trực tiếp
  // close() của dialogStatePort/dialogStore.
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
                  aria-label="Đóng"
                >
                  ×
                </button>
              </DialogPrimitive.Close>
            </div>
            <WorkflowPanel />
            <section
              id="status-section"
              className={`translation-status-panel${statusArea.visible ? "" : " hidden"}`}
              aria-label="Tiến độ tác vụ"
            >
              {/* Giá trị mặc định props phía status được siết ở đợt khác; tại đây bổ sung phía gọi để đáp ứng chữ ký hiện tại. */}
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
