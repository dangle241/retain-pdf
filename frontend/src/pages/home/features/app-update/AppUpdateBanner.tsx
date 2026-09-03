// AppUpdateBanner (React version: app-update button + detail dialog, blueprint §5).
//
// Old world "two DOM nodes belonging to two hosts" issue (button in app-settings-dialog
// template, detail dialog in app-shell-header.js) merged into one component here: this
// component is entirely mounted under SettingsHubDialog.jsx "Updates" tab panel (that panel
// uses the hidden attribute to toggle, not unmount — same treatment as
// SettingsHubDialog.jsx header comment), both button and dialog are permanent child nodes
// here. Dialog only opens when user clicks this component's own button (at which point the
// "Updates" tab is certainly active, ancestors have no hidden), no "parent hidden causing
// accidental dialog open" scenario.
//
// Dialog rendering layer (Stage C, shadcn refactor): detail dialog switched from native
// <dialog> + showModal/close to radix-ui Dialog primitives, not going through
// src/components/ui/dialog.jsx default skin (className continues using the bespoke
// desktop-dialog/desktop-shell/app-update-* CSS). open controlled by the local
// useAppUpdateDialogOpen (pure UI transient, not in store — this entry's decisions are
// immutable), onOpenChange calls setDialogOpen(false) uniformly when next===false, three
// entry paths (Escape / backdrop click / Close button) all go through this one callback.
// No forceMount (same conclusion as CredentialsDialog.jsx header comment, avoids the null
// obstacle defect where hideOthers permanently takes effect) — this detail dialog content is
// always read-only display (status text / description / links), no form input, unloading on
// Close loses no data.
//
// AppShellHeader.jsx no longer has residual app-update-dialog template skeleton
// (3a legacy, already cleaned up; avoids id duplication violating visual baseline/guard).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_UPDATE_IDS } from "./app-update-contract.js";
import { useAppUpdateDialogOpen } from "./useAppUpdateDialogOpen.js";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size is inferred as required in unannotated source files; unstyled path doesn't use size at runtime.
const Button = ButtonBase as any;

// Copied from src/js/features/app-update/view.js:47-60 (formatReleaseNotes) — pure
// function, character-for-character preserved, copied into this component (blueprint
// §5: AppUpdateBanner agent scope).
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
  const notesText = formatReleaseNotes(panel.body) || "No update notes available.";
  const versionText = panel.latestVersion
    ? `Current ${panel.currentVersion} · Latest ${panel.latestVersion}`
    : `Current ${panel.currentVersion}`;
  const statusText = `${state.statusText || ""}`;

  return (
    <>
      <Button
        id={APP_UPDATE_IDS.button}
        className={`app-settings-action app-update-btn${hasUpdate ? " has-update" : ""}`}
        aria-label="Check for Updates"
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
                  <Button className="desktop-close app-update-close" aria-label="Close">×</Button>
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
                  Recheck
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





