// CredentialsDialog(React version of <browser-credentials-dialog>, compared
// components/dialogs/browser-credentials-dialog.js item by item id mirror + browser.js
// (kept controller) open/close/validate/save orchestration).
//
// Dialog rendering layer(Phase C, shadcn refactor): replace native <dialog>+showModal/close with
// radix-ui Dialog primitives(DialogPrimitive.Root/Portal/Overlay/Content), bypassing
// src/components/ui/dialog.jsx that default skin layer(className Continue to use existing
// desktop-dialog/desktop-shell bespoke CSS). open controlled by
// credentialsDialogStore(useCredentialsController open), onOpenChange
// when next===false, unified call to dialogStore.close() â EscapeClick backplate
// (DialogPrimitive.Overlay other outside-click detection) Close
// (DialogPrimitive.Close)All 3 paths use this callback.,No manual writing needed.
// handleBackdropClick/keydown Listen.
//
// Do not forceMount Content/Overlay: Radix modal Content contains one
// hideOthers(content)(aria-hidden sibling node) effect, actual dependencies
// mount/unmount lifecycle(deps=[]), forceMount causes it to... when the dialog has never been opened.
// Permanent â instead, creates new accessibility defects. Confirmed when dialog closes OCR/DeepSeek/Task
// Unsaved option drafts will be lost.(Input is uncontrolled ref,Reset on unmount.),But there is none.
// Test/Product semantics requirements "Keep unsaved draft after close", acceptable. More intuitive.
// Dialog UX(Draft is not persisted before saving)。
//
// Open entry point:APP_EVENTS.openBrowserCredentials
// - setupMode=true → This modal (first-time config gate, standalone「Interface settings」）
// - Otherwise → Settings Center API District (unique regular fill Key Entry point, prevent double windows
// HeroUpload access control. AI missing key banners, submissions share same event.
//
// Tabs implementation(Phase B, shadcn refactor): same as SettingsHubDialog.jsx choice â direct use.
// radix-ui Tabs primitive, bypassing src/components/ui/tabs.jsx default skin(avoid
// credential-tabs/credential-panel bespoke CSS conflict). activeTab driven by
// useCredentialsController view.activeTab(not owned by this component
// useState),Radix use controlled mode:value={activeTab} +
// onValueChange={feature.activateCredentialTab} â originally attached to each trigger's
// onClick Converge to Root Level one callback,Behavior unchanged.
//
// TaskOptionsPanel persistent mount(doesn't follow tab unmount, see JSX inline comment below) existing line.
// Constraints remain: TabsPrimitive.Content forceMount + explicit hidden override(Radix
// Internal calculation generates a copy. hidden, but contentProps expand order follows, passed internally. hidden
// Value takes effect),semantics identical to original manual hidden Properties identical.——Only when dialog is in
// Only meaningful when open.(On dialog close Content Uninstall all,tab Permanent mounting is out of the question.)。

import { Dialog as DialogPrimitive } from "radix-ui";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CredentialsWorkbench } from "./CredentialsWorkbench.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";
import { APP_EVENTS } from "../../composition/external.js";

// Button.size inferred as required in unannotated source; unstyled path does not use size at runtime.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsDialog() {
  const { open, view, feature, dialogStore } = useCredentialsController();
  const services = useHomeServices();
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
// Normal: open only "Settings â API Settings" Only first config shows standalone popup
    if (detail.setupMode) {
      feature?.openBrowserCredentialsDialog({ setupMode: true });
      return;
    }
    services.settingsHub?.dialogStore?.open?.({ tab: "api" });
  });

// Esc / backdrop click / all close buttons use this single callback to write back to store(dialogStore.close()
// Idempotent for closed state no-op, and handlers.save() internal viewPort.closeDialog()
  // No conflicts.)。
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
                  <h2 id={BROWSER_IDS.title}>{setupMode ? "首次配置" : "接口设置"}</h2>
                </DialogPrimitive.Title>
                <p id={BROWSER_IDS.subtitle} className="muted hidden"></p>
              </div>
              <DialogPrimitive.Close asChild>
<Button id={BROWSER_IDS.closeButton} className="dialog-close-btn" aria-label="Close">Ã</Button>
              </DialogPrimitive.Close>
            </div>
            {/* Form body extracted to CredentialsWorkbenchSự cố trong middleware xác thực. Kiểm tra hết hạn token sử dụng `<` không phải `<=`. Sửa: SettingsHubDialog API area
                Shared implementation; modal now only handles first-time config.setupModeone scenario. */}
            <div className="desktop-body credential-dialog-body">
              <CredentialsWorkbench />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
