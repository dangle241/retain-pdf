// AppUpdateBanner (nút app-update React + dialog chi tiết, bản thiết kế §5).
//
// Vấn đề cũ "hai DOM thuộc hai host" (nút trong template app-settings-dialog,
// dialog chi tiết trong app-shell-header.js) được hợp nhất thành một thành phần; toàn bộ thành phần gắn
// dưới bảng tab "Cập nhật" của SettingsHubDialog.jsx (bảng chuyển bằng thuộc tính hidden, không gỡ
// ; xem cách tương tự trong chú thích đầu SettingsHubDialog.jsx); nút và dialog đều là
// nút con thường trực. Dialog chỉ mở khi người dùng bấm nút của chính thành phần (lúc đó tab "Cập nhật"
// chắc chắn active và tổ tiên không hidden), không có tình huống "mở nhầm dialog khi cha bị ẩn".
//
// Lớp kết xuất Dialog (giai đoạn C, chuyển đổi shadcn): dialog chi tiết chuyển từ <dialog> gốc +
// showModal/close sang primitive Dialog của radix-ui, không qua src/components/ui/dialog.jsx
// với giao diện mặc định; className tiếp tục dùng bộ desktop-dialog/desktop-shell/app-update-*
// CSS riêng. open do useAppUpdateDialogOpen cục bộ kiểm soát (trạng thái UI tạm, không vào
// store; giữ quyết định hiện có), onOpenChange gọi thống nhất
// setDialogOpen(false) khi next===false; Escape/bấm nền/nút đóng đều đi qua callback này.
// Không forceMount, theo kết luận trong chú thích đầu CredentialsDialog.jsx, để tránh hideOthers tồn tại vĩnh viễn
// gây lỗi trợ năng; nội dung dialog chi tiết đều chỉ đọc (trạng thái/mô tả/
// liên kết), không có biểu mẫu nên gỡ khi đóng không mất dữ liệu.
//
// AppShellHeader.jsx không còn khung template app-update-dialog từ 3a; đã dọn
// để tránh id trùng vi phạm đường cơ sở/cổng kiểm tra.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_UPDATE_IDS } from "./app-update-contract.js";
import { useAppUpdateDialogOpen } from "./useAppUpdateDialogOpen.js";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size bị suy ra là bắt buộc trong tệp nguồn chưa chú kiểu; luồng unstyled không dùng size ở runtime.
const Button = ButtonBase as any;

// Sao chép từ src/js/features/app-update/view.js:47-60 (formatReleaseNotes), là hàm thuần,
// giữ từng ký tự trong thành phần này (phạm vi AppUpdateBanner trong bản thiết kế §5).
function formatReleaseNotes(markdown = "") {
  return `${markdown || ""}`
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*]\s+/, "• ")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trimEnd())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim();
}

export function AppUpdateBanner() {
  const services = useHomeServices();
  const { view, handlersRef } = services.appUpdate;
  const state = useStoreSnapshot(view.store);
  const [dialogOpen, setDialogOpen] = useAppUpdateDialogOpen();
  const { onCloseAutoFocus } = useDialogReturnFocus(dialogOpen);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      setDialogOpen(false);
    }
  }

  const hasUpdate = Boolean(state.hasUpdate);
  const panel = state.panel;
  const notesText = formatReleaseNotes(panel.body) || "Chưa có ghi chú cập nhật.";
  const versionText = panel.latestVersion
    ? `Hiện tại ${panel.currentVersion} · Mới nhất ${panel.latestVersion}`
    : `Hiện tại ${panel.currentVersion}`;
  const statusText = `${state.statusText || ""}`;

  return (
    <>
      <Button
        id={APP_UPDATE_IDS.button}
        className={`app-settings-action app-update-btn${hasUpdate ? " has-update" : ""}`}
        aria-label="Kiểm tra cập nhật"
        title={state.buttonTitle}
        data-update-state={state.buttonState}
        onClick={() => setDialogOpen(true)}
      >
        Kiểm tra cập nhật
        <span className="app-update-dot" aria-hidden="true"></span>
      </Button>
      <DialogPrimitive.Root open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="desktop-dialog-overlay app-update-overlay" />
          <DialogPrimitive.Content
            id={APP_UPDATE_IDS.dialog}
            className="desktop-dialog app-update-dialog"
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="desktop-shell app-update-shell">
              <div className="app-update-head">
                <div>
                  <DialogPrimitive.Title asChild>
                    <h2>{panel.title}</h2>
                  </DialogPrimitive.Title>
                  <p>{versionText}</p>
                </div>
                <DialogPrimitive.Close asChild>
                  <Button className="desktop-close app-update-close" aria-label="Đóng">×</Button>
                </DialogPrimitive.Close>
              </div>
              <div className="app-update-body">
                <div id={APP_UPDATE_IDS.status} className={`app-update-status${statusText ? "" : " hidden"}`}>{statusText}</div>
                <div className="app-update-notes">{notesText}</div>
              </div>
              <div className="app-update-foot">
                <Button
                  id={APP_UPDATE_IDS.checkButton}
                  className="home-action-btn secondary"
                  onClick={() => handlersRef.current?.onCheck?.()}
                >
                  Kiểm tra lại
                </Button>
                <a
                  className={`app-update-link${panel.htmlUrl ? "" : " hidden"}`}
                  href={panel.htmlUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở bản phát hành
                </a>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
