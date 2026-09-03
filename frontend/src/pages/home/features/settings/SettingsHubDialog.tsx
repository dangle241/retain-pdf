// SettingsHubDialog v2: left nav + right content area (former "lobby dialog"
// horizontal pill layout retired).
//
// Layout: left vertical nav (icon + name, Radix Tabs orientation=vertical,
// arrow-key ready), right content pane (each section has its own Title row +
// body, independent scrolling). Appearance section is promoted as the main stage
// for the Theme card Grid; API/Glossary still have their own top-level dialogs
// (CredentialsDialog/GlossariesDialog, each with its own controller/store/test
// contract), and this panel serves as the "entry point" for them — if embedding
// is needed later, the change goes to those two features, not here.
//
// 【Test contracts, must not break】 (credentials/glossaries/app-update component tests):
// - #app-settings-dialog / #app-settings-close-btn
// - [data-settings-tab="api|glossary|appearance|update"] clickable
// - [data-settings-panel=...] forceMount + hidden attribute toggle (test asserts .hidden)
// - #credentials-btn / #glossary-btn open corresponding sub-dialogs
// - Appearance panel #theme-appearance-panel and #theme-option-<id>
//
// Open/close state across subtrees goes through settings-hub-dialog-store; tab
// switching is transient within the subtree (useState). Content/Overlay are NOT
// forceMounted (Radix hideOthers depends on real mount/unmount; see
// CredentialsDialog header comment). AppUpdateBanner mount lifecycle note:
// background health check is driven by composition's pure logic controller, with
// no relation to the component's yes/no mount state (see old file header
// conclusion).

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

// Button.size is inferred as required in an untyped source file; unstyled path
// does not need size at runtime.
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
  { id: "api", label: "API Settings", Icon: IconKey },
  { id: "glossary", label: "Glossary", Icon: IconBook },
  { id: "appearance", label: "Appearance", Icon: IconPalette },
  { id: "update", label: "Updates", Icon: IconUpdate },
];

const PANE_HEADS = {
  api: { title: "API Settings", desc: "Configure OCR tokens, DeepSeek keys, model endpoints, and job options. Changes apply after saving." },
  glossary: { title: "Glossary", desc: "Manage fixed translations, reserved terms, and terminology preferences." },
  appearance: { title: "Appearance", desc: "Select a color scheme. Changes take effect immediately and are remembered." },
  update: { title: "Updates", desc: "View the current version and check for updates from GitHub Releases." },
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

  // API section embeds credentials workbench: populates form from credentials state
  // when entering the api tab (no second-level dialog). forceMount guarantees the
  // panel is mounted; rAF runs a second time to avoid a blank password field if
  // the ref hasn't attached yet, so Save doesn't read an empty string.
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
    // Plain literal concatenation (with space-separated values) to avoid the v4
    // scanner's `x${y}` template literal pitfall.
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
                  <h2>Settings</h2>
                </DialogPrimitive.Title>
                <TabsPrimitive.List className="app-settings-nav" aria-label="SettingsCategory">
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
                    aria-label="Close"
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
                  {/* Credentials workbench embedded directly (no second-level dialog);
                      shares status source with First-run setup. */}
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
                      Glossaries define fixed translations and reserved terms. You can maintain multiple glossaries and
                      enable them as needed; they apply when translation jobs start.
                    </p>
                    <Button id={APP_SETTINGS_DIALOG_IDS.glossaryButton} className="app-settings-action" onClick={openGlossaries}>
                      Open Glossary
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
                  {/* AppUpdateBanner: button + detail dialog combined (blueprint §5).
                      Mount lifecycle decoupled from background health check — conclusion
                      in file header. */}
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




