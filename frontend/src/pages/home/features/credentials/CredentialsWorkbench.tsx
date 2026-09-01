// CredentialsWorkbenchCredentials form body (API/Duplicate task options tab + panel + save row),
// Extracted dual-host component from CredentialsDialog:
//   1. SettingsHubDialog API in-area embed (standard entry, no second-level popup)
//   2. CredentialsDialog(only the first-time setup gateway setupMode A Scene)
// Mutually exclusive host mounts (modal settings; door popup triggers only from upload guide). BROWSER_IDS
// DOM id no duplicates on screen. Status/Save/Run all validations. useCredentialsController
// Singleton store——Host is just a shell.
//
// TaskOptionsPanel Persistent mount (not following tab Uninstall constraints apply. CredentialsDialog
// Header comment conclusion: its fields ref reads unified on save; unmount reproduces "Switch to API Panel click
// Save silently drops task options."。

import { Tabs as TabsPrimitive } from "radix-ui";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OcrProviderPanels } from "./OcrProviderPanels.jsx";
import { DeepSeekPanel } from "./DeepSeekPanel.jsx";
import { TaskOptionsPanel } from "./TaskOptionsPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size inferred as required in unannotated source; unstyled path does not use size at runtime.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

const TABS = [
  { id: "api", label: "API 设置" },
  { id: "task", label: "Task Options" },
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
aria-label="Interface Settings"
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
          {/* Not set TabsPrimitive.Content reason see CredentialsDialog Please provide the Chinese comment text for translation.
              TaskOptionsPanel Built-in role=tabpanelwrapping again causes semantic duplication */}
          <TaskOptionsPanel hidden={activeTab !== "task"} />
        </div>
        <div className="actions credential-dialog-actions">
          <span id={BROWSER_IDS.status} className={statusClasses}>{statusContent}</span>
          <Button
            id={BROWSER_IDS.saveButton}
            className="app-button"
            onClick={() => handlers?.save?.()}
          >
            {setupMode ? "Save & Start" : "保存"}
          </Button>
        </div>
      </div>
    </TabsPrimitive.Root>
  );
}
