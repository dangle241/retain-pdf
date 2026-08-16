// CredentialsWorkbench: thân biểu mẫu xác thực (hai tab API/tùy chọn tác vụ + bảng + hàng lưu),
// thành phần hai host tách từ CredentialsDialog:
//   1. Nhúng trong vùng API của SettingsHubDialog (entry thông thường, không có hộp thoại tầng hai)
//   2. CredentialsDialog (chỉ còn tình huống cổng cấu hình đầu tiên setupMode)
// Hai host gắn loại trừ nhau (cài đặt là modal, hộp thoại cổng chỉ được kích hoạt từ hướng dẫn tải lên), nên
// DOM id của BROWSER_IDS không trùng trên cùng màn hình. Trạng thái/lưu/kiểm tra đều dùng
// singleton store của useCredentialsController; host chỉ là vỏ.
//
// Ràng buộc TaskOptionsPanel luôn gắn, không gỡ theo tab, tiếp tục theo kết luận trong chú thích đầu
// CredentialsDialog: ref trường được đọc thống nhất khi lưu; gỡ sẽ tái hiện lỗi "chuyển sang bảng API rồi bấm
// Lưu, tùy chọn tác vụ âm thầm mất".

import { Tabs as TabsPrimitive } from "radix-ui";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OcrProviderPanels } from "./OcrProviderPanels.jsx";
import { DeepSeekPanel } from "./DeepSeekPanel.jsx";
import { TaskOptionsPanel } from "./TaskOptionsPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size bị suy ra là bắt buộc trong tệp nguồn chưa chú kiểu; luồng unstyled không dùng size ở runtime.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

const TABS = [
  { id: "api", label: "Cài đặt API" },
  { id: "task", label: "Tùy chọn tác vụ" },
];

export function CredentialsWorkbench() {
  const { view, feature, handlers } = useCredentialsController();

  const setupMode = Boolean(view.setupMode);
  const activeTab = view.activeTab || "api";
  const dialogStatus = view.dialogStatus || { message: "", tone: "" };
  const statusContent = `${dialogStatus.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    dialogStatus.tone === "valid" ? "is-valid" : "",
    dialogStatus.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <TabsPrimitive.Root
      className="contents"
      value={activeTab}
      onValueChange={(tab) => feature?.activateCredentialTab(tab)}
    >
      <div className="credential-workbench">
        <TabsPrimitive.List
          id={BROWSER_IDS.tabs}
          className={`developer-tabs credential-tabs${setupMode ? " hidden" : ""}`}
          aria-label="Cài đặt API"
        >
          {TABS.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.id}
              value={tab.id}
              id={tab.id === "api" ? BROWSER_IDS.tabApi : BROWSER_IDS.tabTask}
              className={`developer-tab credential-tab${activeTab === tab.id ? " is-active" : ""}`}
              data-credential-tab={tab.id}
            >
              {tab.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        <div className="credential-panels">
          <TabsPrimitive.Content
            value="api"
            forceMount
            hidden={activeTab !== "api"}
            className={`credential-panel${activeTab === "api" ? " is-active" : ""}`}
            data-credential-panel="api"
          >
            <div className="credential-card-grid credential-card-grid-compact credential-api-grid">
              <section className="credential-card">
                <div className="credential-card-head">
                  <h3>OCR</h3>
                </div>
                <OcrProviderPanels />
              </section>
              <DeepSeekPanel />
            </div>
          </TabsPrimitive.Content>
          {/* Lý do không bọc TabsPrimitive.Content nằm trong chú thích gốc của CredentialsDialog:
              TaskOptionsPanel đã có role=tabpanel, bọc thêm sẽ lặp ngữ nghĩa. */}
          <TaskOptionsPanel hidden={activeTab !== "task"} />
        </div>
        <div className="actions credential-dialog-actions">
          <span id={BROWSER_IDS.status} className={statusClasses}>{statusContent}</span>
          <Button
            id={BROWSER_IDS.saveButton}
            className="app-button"
            onClick={() => handlers?.save?.()}
          >
            {setupMode ? "Lưu và khởi động" : "Lưu"}
          </Button>
        </div>
      </div>
    </TabsPrimitive.Root>
  );
}
