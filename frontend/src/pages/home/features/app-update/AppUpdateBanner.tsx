// AppUpdateBanner (React version app-update button + details dialog, Blueprint Â§5).
//
// Old World "two DOM elements in two hosts" problem (button in app-settings-dialog template,
// details dialog in app-shell-header.js) merged into one component here: mount entire component
// in SettingsHubDialog.jsx "Update" tab under panel (this panel uses hidden Toggle Properties, not unmounted
// ââ see SettingsHubDialog.jsx same header comment handling), button and dialog are all resident here
// Child nodes.dialog opens only on own button click (now "Update"
// tab Must be active, ancestors not. hidden),Not found"mistakenly opens when parent is hidden dialog"scenario of.
//
// Dialog rendering layer (Phase C, shadcn refactor): details dialog from Native <dialog> +
// showModal/close replaced by radix-ui Dialog primitive, not via src/components/ui/dialog.jsx
// default skin(className Continue to use desktop-dialog/desktop-shell/app-update-* this set
// bespoke CSS). open local control useAppUpdateDialogOpen (pure UI transient state, do not enter
// store ââ existing decision unchanged), onOpenChange calls uniformly when next===false.
// setDialogOpen(false),Escape/Backplate click. Handle event. Simplify: inline function, remove unnecessary state./Close button: all three paths use this one callback.
// No forceMount (same as CredentialsDialog.jsx header comment conclusion, avoid unnecessary features. Simplify. hideOthers permanent
// accessibility defect that takes effect) ââ details dialog all content read-only (status copy/description/
// links), no form input, unmounting on close preserves all data.
//
// AppShellHeader.jsx no longer retains app-update-dialog template skeleton (3a legacy, cleared,
// avoid repeated ID visual baseline violations / access control).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_UPDATE_IDS } from "./app-update-contract.js";
import { useAppUpdateDialogOpen } from "./useAppUpdateDialogOpen.js";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size Inferred required in unannotated source files.;unstyled path-level size。
const Button = ButtonBase as any;

// Copied from src/js/features/app-update/view.js:47-60(formatReleaseNotes)——Pure function,
// Preserve character by character, copy into this component (Blueprint Â§5: AppUpdateBanner agent scope).
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
  const notesText = formatReleaseNotes(panel.body) || "No update notes.";
  const versionText = panel.latestVersion
? `Current ${panel.currentVersion} Â· Latest ${panel.latestVersion}`
: `Current ${panel.currentVersion}`;
  const statusText = `${state.statusText || ""}`;

  return (
    <>
      <Button
        id={APP_UPDATE_IDS.button}
        className={`app-settings-action app-update-btn${hasUpdate ? " has-update" : ""}`}
        aria-label="Check for updates"
        title={state.buttonTitle}
        data-update-state={state.buttonState}
        onClick={() => setDialogOpen(true)}
      >
        Check for Updates
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
<Button className="desktop-close app-update-close" aria-label="Close">Ã</Button>
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
                  re-check
                </Button>
                <a
                  className={`app-update-link${panel.htmlUrl ? "" : " hidden"}`}
                  href={panel.htmlUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
Open Release
                </a>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
