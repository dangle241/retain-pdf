// CredentialsDialog (React version of <browser-credentials-dialog>, Side-by-side
// components/dialogs/browser-credentials-dialog.js id-by-id mirror + browser.js
// (kept controller) open/close/validation/save orchestration).
//
// Dialog rendering layer (Stage C, shadcn refactor): switched from native <dialog>+showModal/close
// to radix-ui Dialog primitives (DialogPrimitive.Root/Portal/Overlay/Content), not going
// through src/components/ui/dialog.jsx default skin (className continues using existing
// desktop-dialog/desktop-shell bespoke CSS). open controlled by credentialsDialogStore
// (useCredentialsController's open), onOpenChange calls dialogStore.close() uniformly when
// next===false — Escape, backdrop click (outside-click detection outside
// DialogPrimitive.Overlay), Close button (DialogPrimitive.Close) all three entry paths go
// through this one callback; no need to manually write handleBackdropClick/keydown
// listeners.
//
// No forceMount for Content/Overlay: Radix modal Content internally has a
// hideOthers(content) effect (aria-hidden sibling nodes), relying on the component's real
// mount/unmount lifecycle (deps=[]); forceMount makes it permanently effective from the moment
// the dialog has never been opened — creates a new defect instead. Confirmed: on dialog
// close, OCR/DeepSeek/task options unsaved drafts are lost (inputs are uncontrolled refs;
// component unmount resets them), but no test or product semantics require "preserve unsaved
// drafts after close" — acceptable, more intuitive Dialog UX (drafts don't persist before save).
//
// Open entry: APP_EVENTS.openBrowserCredentials
// - setupMode=true → this dialog (first-run setup gate; standalone "API Settings")
// - all other cases → Settings hub API section (only normal key-entry path; avoids dual windows)
// HeroUpload gate, AI missing-key banner, upload flow all go through the same event.
//
// Tabs implementation (Stage B, shadcn refactor): same as SettingsHubDialog.jsx's Select — directly
// use radix-ui Tabs primitives, not going through src/components/ui/tabs.jsx default skin
// (avoids conflict with bespoke credential-tabs/credential-panel CSS). activeTab driven by
// useCredentialsController's view.activeTab (not this component's own useState), Radix follows
// controlled mode: value={activeTab} + onValueChange={feature.activateCredentialTab} — original
// onClick on each trigger converged to one Root-level callback, behavior unchanged.
//
// TaskOptionsPanel permanently mounted (not unmounted with tab; see inline JSX comment below)
// this existing constraint continues: TabsPrimitive.Content's forceMount + explicit hidden
// override (Radix computes its own hidden internally, but contentProps spread order comes after;
// our own hidden value takes effect), semantics identical to the original handwritten hidden
// attribute — this only makes sense when dialog is in open state (when dialog closes, Content
// unmounts entirely; tab permanent mount concern doesn't apply).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CredentialsWorkbench } from "./CredentialsWorkbench.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";
import { APP_EVENTS } from "../../composition/external.js";

// Button.size inferred as required in untyped source files; unstyled path doesn't need size at runtime.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsDialog() {
  const { open, view, feature, dialogStore } = useCredentialsController();
  const services = useHomeServices();
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    // Normal: only open "Settings → API Settings"; only first-run setup goes through standalone dialog
    if (detail.setupMode) {
      feature?.openBrowserCredentialsDialog({ setupMode: true });
      return;
    }
    services.settingsHub?.dialogStore?.open?.({ tab: "api" });
  });

  // Esc / backdrop click / Close button all write to store via this one callback (dialogStore.close()
  // is idempotent no-op for already-closed status; doesn't conflict with handlers.save() which
  // internally calls viewPort.closeDialog()).
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
                  <h2 id={BROWSER_IDS.title}>{setupMode ? "First-run setup" : "API Settings"}</h2>
                </DialogPrimitive.Title>
                <p id={BROWSER_IDS.subtitle} className="muted hidden"></p>
              </div>
              <DialogPrimitive.Close asChild>
                <Button id={BROWSER_IDS.closeButton} className="dialog-close-btn" aria-label="Close">×</Button>
              </DialogPrimitive.Close>
            </div>
            {/* Form body extracted to CredentialsWorkbench (shared implementation with
                SettingsHubDialog API section); this dialog now only has first-run setup
                gate (setupMode) as a scenario. */}
            <div className="desktop-body credential-dialog-body">
              <CredentialsWorkbench />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}



