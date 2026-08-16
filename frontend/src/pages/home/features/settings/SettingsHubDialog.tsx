// SettingsHubDialog v2: điều hướng bên trái + vùng nội dung bên phải (bỏ bố cục pill ngang của "hộp thoại sảnh" cũ).
//
// Bố cục: điều hướng dọc bên trái (biểu tượng + tên, Radix Tabs orientation=vertical, dùng được phím mũi tên),
// khung nội dung bên phải (mỗi vùng có hàng tiêu đề + nội dung và cuộn độc lập). Vùng giao diện được nâng thành lưới thẻ chủ đề
// làm khu vực chính; API/bảng thuật ngữ vẫn là hộp thoại cấp cao độc lập do có biểu mẫu thật (CredentialsDialog/
// GlossariesDialog, mỗi phần có controller/store/hợp đồng kiểm thử riêng), panel này đóng vai trò "khu khởi chạy"
// và giữ nút truy cập; nếu cần nhúng sau này thì sửa hai feature đó, không sửa tại đây.
//
// [Hợp đồng kiểm thử, không được phá khi thiết kế lại] (kiểm thử component credentials/glossaries/app-update):
// - #app-settings-dialog / #app-settings-close-btn
// - Có thể bấm [data-settings-tab="api|glossary|appearance|update"].
// - [data-settings-panel=…] dùng forceMount + chuyển thuộc tính hidden (kiểm thử assert .hidden).
// - #credentials-btn / #glossary-btn mở hộp thoại con tương ứng.
// - Panel giao diện #theme-appearance-panel và #theme-option-<id>.
//
// Trạng thái đóng/mở xuyên cây con dùng settings-hub-dialog-store; chuyển tab là trạng thái tạm trong cây con (useState).
// Không forceMount Content/Overlay của Dialog (Radix hideOthers phụ thuộc vào việc
// mount/unmount thực tế, xem comment đầu CredentialsDialog). Vòng đời mount của AppUpdateBanner
// được giải thích trong kết luận ở comment đầu bản cũ: tự kiểm tra nền do controller logic thuần của composition điều khiển,
// không phụ thuộc component này có được mount hay không.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_SETTINGS_DIALOG_IDS } from "../credentials/credentials-dom-ids.js";
import { AppUpdateBanner } from "../app-update/AppUpdateBanner.jsx";
import { CredentialsWorkbench } from "../credentials/CredentialsWorkbench.jsx";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size bị suy ra là bắt buộc trong tệp nguồn chưa chú kiểu; luồng unstyled không dùng size ở runtime.
const Button = ButtonBase as any;

function IconKey(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M14.5 9.5a4 4 0 1 1-1.2 2.86L5 20.65 3.35 19 11.6 10.7A4 4 0 0 1 14.5 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function IconBook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5.5 5.2A2.2 2.2 0 0 1 7.7 3H19v15.5H7.7a2.2 2.2 0 0 0-2.2 2.2V5.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 5.2A2.2 2.2 0 0 0 3.3 3H3v15.5h.3a2.2 2.2 0 0 1 2.2 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function IconPalette(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3a9 9 0 1 0 9 9c0-.5-.04-1-.12-1.48a5 5 0 0 1-6.4-6.4A9 9 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="15.2" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}
function IconUpdate(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v2.1M12 16.9V19M5 12h2.1M16.9 12H19M7.05 7.05l1.5 1.5M15.45 15.45l1.5 1.5M16.95 7.05l-1.5 1.5M8.55 15.45l-1.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const TABS = [
  { id: "api", label: "Cài đặt API", Icon: IconKey },
  { id: "glossary", label: "Thuật ngữ", Icon: IconBook },
  { id: "appearance", label: "Giao diện", Icon: IconPalette },
  { id: "update", label: "Cập nhật", Icon: IconUpdate },
];

const PANE_HEADS = {
  api: { title: "Cài đặt API", desc: "Cấu hình OCR Token, DeepSeek Key, địa chỉ mô hình và tùy chọn tác vụ; thay đổi có hiệu lực ngay sau khi lưu." },
  glossary: { title: "Bảng thuật ngữ", desc: "Quản lý bản dịch cố định, từ giữ nguyên và lựa chọn thuật ngữ chuyên ngành." },
  appearance: { title: "Giao diện", desc: "Chọn bảng màu giao diện; thay đổi có hiệu lực ngay và được ghi nhớ trên máy này." },
  update: { title: "Cập nhật", desc: "Xem phiên bản hiện tại và kiểm tra lại cập nhật từ GitHub Releases." },
};

function PaneHead({ tab }: { tab: keyof typeof PANE_HEADS }) {
  const head = PANE_HEADS[tab];
  return (
    <header className="app-settings-pane-head">
      <h3>{head.title}</h3>
      <p>{head.desc}</p>
    </header>
  );
}

export function SettingsHubDialog() {
  const services = useHomeServices();
  const { dialogStore } = services.settingsHub;
  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(dialogState.payload?.tab || "api");

  useEffect(() => {
    if (open) {
      setActiveTab(dialogState.payload?.tab || "api");
    }
  }, [open]);

  // Vùng API nhúng bàn làm việc thông tin xác thực: khi vào tab api, điền lại biểu mẫu từ trạng thái xác thực (không mở hộp thoại tầng hai).
  // forceMount bảo đảm panel đã mount; rAF điền thêm một lần để tránh ref chưa gắn khiến ô mật khẩu trống và thao tác lưu đọc chuỗi rỗng.
  useEffect(() => {
    if (!open || activeTab !== "api") {
      return;
    }
    const prepare = () => services.credentials?.feature?.prepareCredentialsPanels?.();
    prepare();
    const raf = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(raf);
  }, [open, activeTab, services]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  function openGlossaries() {
    services.glossaries.dialogStore.open();
  }

  function panelClass(tab: string) {
    // Nối literal thuần (có dấu cách phân tách) để tránh lỗi scanner v4 với template `x${y}`.
    return activeTab === tab ? "app-settings-panel is-current" : "app-settings-panel";
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={APP_SETTINGS_DIALOG_IDS.dialog}
          className="desktop-dialog app-settings-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell app-settings-shell">
            <TabsPrimitive.Root
              className="app-settings-layout"
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <aside className="app-settings-rail">
                <DialogPrimitive.Title asChild>
                  <h2>Cài đặt</h2>
                </DialogPrimitive.Title>
                <TabsPrimitive.List className="app-settings-nav" aria-label="Danh mục cài đặt">
                  {TABS.map(({ id, label, Icon }) => (
                    <TabsPrimitive.Trigger
                      key={id}
                      value={id}
                      className={activeTab === id ? "is-active" : ""}
                      data-settings-tab={id}
                    >
                      <Icon />
                      {label}
                    </TabsPrimitive.Trigger>
                  ))}
                </TabsPrimitive.List>
              </aside>

              <div className="app-settings-pane">
                <DialogPrimitive.Close asChild>
                  <Button
                    id={APP_SETTINGS_DIALOG_IDS.closeButton}
                    className="dialog-close-btn app-settings-close"
                    aria-label="Đóng"
                  >
                    ×
                  </Button>
                </DialogPrimitive.Close>

                <TabsPrimitive.Content
                  value="api"
                  forceMount
                  hidden={activeTab !== "api"}
                  className={panelClass("api")}
                  data-settings-panel="api"
                >
                  <PaneHead tab="api" />
                  {/* Nhúng trực tiếp bàn làm việc thông tin xác thực (không có hộp thoại tầng hai); dùng chung với cổng thiết lập lần đầu
                      CredentialsWorkbench, cùng một nguồn trạng thái. */}
                  <CredentialsWorkbench />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="glossary"
                  forceMount
                  hidden={activeTab !== "glossary"}
                  className={panelClass("glossary")}
                  data-settings-panel="glossary"
                >
                  <PaneHead tab="glossary" />
                  <div className="app-settings-launcher">
                    <p>
                      Bảng thuật ngữ xác định bản dịch cố định và từ cần giữ nguyên. Có thể quản lý nhiều bảng và
                      bật khi cần; chúng có hiệu lực khi bắt đầu tác vụ dịch.
                    </p>
                    <Button id={APP_SETTINGS_DIALOG_IDS.glossaryButton} className="app-settings-action" onClick={openGlossaries}>
                      Mở bảng thuật ngữ
                    </Button>
                  </div>
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="appearance"
                  forceMount
                  hidden={activeTab !== "appearance"}
                  className={panelClass("appearance")}
                  data-settings-panel="appearance"
                >
                  <PaneHead tab="appearance" />
                  <ThemeAppearancePanel />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="update"
                  forceMount
                  hidden={activeTab !== "update"}
                  className={panelClass("update")}
                  data-settings-panel="update"
                >
                  <PaneHead tab="update" />
                  {/* AppUpdateBanner: kết hợp nút + hộp thoại chi tiết thành một khối (thiết kế §5).
                      Xem comment đầu file về kết luận tách vòng đời mount khỏi tự kiểm tra nền. */}
                  <AppUpdateBanner />
                </TabsPrimitive.Content>
              </div>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
