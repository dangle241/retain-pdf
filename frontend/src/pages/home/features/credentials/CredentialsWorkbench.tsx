// CredentialsWorkbench: credentials form body (API / task options dual tab + panels + save row),
// dual-host component extracted from CredentialsDialog:
//   1. Embedded in SettingsHubDialog API section (normal entry; not a second-level dialog)
//   2. CredentialsDialog (only remaining scenario is first-run setup gate setupMode)
// Two hosts are mutually exclusive mounts (Settings is modal; gate dialog only triggered from
// upload flow), BROWSER_IDS DOM ids won't duplicate on screen. Status/Save/validation all go
// through useCredentialsController's singleton store — hosts are just shells.
//
// TaskOptionsPanel permanently mounted (not unmounted with tab) constraint carried over from
// CredentialsDialog header comment conclusion: its field refs are read uniformly on save;
// unmounting reproduces "switch to API tab, click Save, task options silently lost".

import { Tabs as TabsPrimitive } from "radix-ui";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OcrProviderPanels } from "./OcrProviderPanels.jsx";
import { DeepSeekPanel } from "./DeepSeekPanel.jsx";
import { TaskOptionsPanel } from "./TaskOptionsPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size is inferred as required in unannotated source files; unstyled path doesn't use size at runtime.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

const TABS = [
  { id: "api", label: "API Settings" },
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
          aria-label="API Settings"
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
          {/* Reason for not wrapping in TabsPrimitive.Content: see CredentialsDialog original comment.
              TaskOptionsPanel has its own role=tabpanel; wrapping adds redundant semantics */}
          <TaskOptionsPanel hidden={activeTab !== "task"} />
        </div>
        <div className="actions credential-dialog-actions">
          <span id={BROWSER_IDS.status} className={statusClasses}>{statusContent}</span>
          <Button
            id={BROWSER_IDS.saveButton}
            className="app-button"
            onClick={() => handlers?.save?.()}
          >
            {setupMode ? "Save and Start" : "Save"}
          </Button>
        </div>
      </div>
    </TabsPrimitive.Root>
  );
}





