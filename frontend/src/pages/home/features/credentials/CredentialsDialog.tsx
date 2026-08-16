// CredentialsDialog (bản React <browser-credentials-dialog>, đối chiếu
// components/dialogs/browser-credentials-dialog.js phản chiếu từng id + browser.js
// là bộ điều khiển được giữ cho điều phối đóng/mở/kiểm tra/lưu).
//
// Lớp kết xuất Dialog (giai đoạn C, chuyển đổi shadcn): chuyển từ <dialog> gốc + showModal/close sang
// primitive Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content), không qua
// lớp giao diện mặc định src/components/ui/dialog.jsx; className tiếp tục dùng
// bộ CSS riêng desktop-dialog/desktop-shell. open được kiểm soát bởi
// credentialsDialogStore (open từ useCredentialsController); onOpenChange
// gọi thống nhất dialogStore.close() khi next===false; Escape, bấm nền
// (phát hiện outside-click ngoài DialogPrimitive.Overlay), bấm nút đóng
// (DialogPrimitive.Close) đều qua callback này, không cần viết tay
// listener handleBackdropClick/keydown.
//
// Không forceMount Content/Overlay: bên trong Radix modal Content có effect
// hideOthers(content), đặt aria-hidden cho nút anh em, phụ thuộc vòng đời
// mount/unmount thật của thành phần (deps=[]); forceMount khiến nó
// có hiệu lực vĩnh viễn dù hộp thoại chưa từng mở, gây lỗi trợ năng mới. Đã xác nhận khi đóng, bản nháp OCR/DeepSeek/tác vụ
// chưa lưu sẽ mất vì input là ref không kiểm soát và reset khi gỡ thành phần, nhưng không có
// yêu cầu test/sản phẩm phải "giữ bản nháp chưa lưu sau khi đóng"; đây là hành vi chấp nhận được và trực giác hơn
// cho UX Dialog vì bản nháp không bền vững trước khi lưu.
//
// Entry mở: APP_EVENTS.openBrowserCredentials.
// - setupMode=true → hộp thoại này (cổng cấu hình đầu tiên, "Cài đặt API" riêng)
// - Trường hợp khác → vùng API trong trung tâm cài đặt (entry nhập Key thông thường duy nhất, tránh hai cửa sổ)
// Cổng HeroUpload, banner AI thiếu Key và luồng gửi đều dùng cùng sự kiện.
//
// Triển khai Tabs (giai đoạn B, chuyển đổi shadcn): giống lựa chọn trong SettingsHubDialog.jsx, dùng trực tiếp
// primitive Tabs của radix-ui, không qua giao diện mặc định src/components/ui/tabs.jsx để tránh xung đột với
// CSS riêng credential-tabs/credential-panel. activeTab được điều khiển bởi
// view.activeTab của useCredentialsController, không phải
// useState riêng của thành phần; Radix dùng chế độ kiểm soát value={activeTab} +
// onValueChange={feature.activateCredentialTab}; các onClick trước đây gắn trên từng trigger
// được gom thành một callback cấp Root, hành vi không đổi.
//
// Ràng buộc TaskOptionsPanel luôn gắn, không gỡ theo tab (xem chú thích JSX bên dưới), tiếp tục được
// giữ bằng forceMount của TabsPrimitive.Content + ghi đè hidden rõ ràng (Radix
// tự tính hidden nhưng contentProps được trải sau, nên hidden do ta truyền
// có hiệu lực cuối), ngữ nghĩa giống thuộc tính hidden viết tay; chỉ có ý nghĩa khi hộp thoại
// đang mở, vì khi đóng toàn bộ Content bị gỡ nên không có tab thường trú.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CredentialsWorkbench } from "./CredentialsWorkbench.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";
import { APP_EVENTS } from "../../composition/external.js";

// Button.size bị suy ra là bắt buộc trong tệp nguồn chưa chú kiểu; luồng unstyled không dùng size ở runtime.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsDialog() {
  const { open, view, feature, dialogStore } = useCredentialsController();
  const services = useHomeServices();
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    // Thông thường: chỉ mở "Cài đặt → Cài đặt API"; chỉ cấu hình đầu tiên dùng hộp thoại riêng.
    if (detail.setupMode) {
      feature?.openBrowserCredentialsDialog({ setupMode: true });
      return;
    }
    services.settingsHub?.dialogStore?.open?.({ tab: "api" });
  });

  // Esc / bấm nền / nút đóng đều ghi lại store qua callback này; dialogStore.close()
  // là no-op lũy đẳng khi đã đóng và không xung đột với viewPort.closeDialog() được handlers.save() gọi
  // ở bên trong.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const setupMode = Boolean(view.setupMode);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={CREDENTIAL_DOM_IDS.dialog}
          className="desktop-dialog"
          data-setup-mode={setupMode ? "1" : "0"}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <div className="credential-dialog-head">
                <DialogPrimitive.Title asChild>
                  <h2 id={BROWSER_IDS.title}>{setupMode ? "Cấu hình ban đầu" : "Cài đặt API"}</h2>
                </DialogPrimitive.Title>
                <p id={BROWSER_IDS.subtitle} className="muted hidden"></p>
              </div>
              <DialogPrimitive.Close asChild>
                <Button id={BROWSER_IDS.closeButton} className="dialog-close-btn" aria-label="Đóng">×</Button>
              </DialogPrimitive.Close>
            </div>
            {/* Phần thân biểu mẫu được tách thành CredentialsWorkbench, dùng chung với vùng API của SettingsHubDialog;
                hộp thoại này chỉ còn tình huống cổng cấu hình đầu tiên setupMode. */}
            <div className="desktop-body credential-dialog-body">
              <CredentialsWorkbench />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
