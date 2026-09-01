// GlossariesDialog family (GlossariesDialog/GlossaryList/GlossaryEditor/
// GlossaryImportPanel) single assembly surface (mirrors useCredentialsController.js) - fold
// composition.js glossaries domain (services.glossaries:{feature, view,
// dialogStore}) into a hook.
//
// Open trigger: #glossary-btn in SettingsHubDialog "Glossary" tab directly calls
// services.glossaries.dialogStore.open() (Blueprint Â§0.4 Call site placeholder, composition
// Takes effect immediately upon readiness.), bypassing APP_EVENTS - this hook uses one open state transition effect to
// "Dialog opened" Bug in auth middleware. Token expiry check use `<` not `<=`. Fix: Change `<` to `<=`. â skipped: Edge case, add when token expiry edge cases require handling. controller.js open() (Internal Meeting openDialog() +
// reloadGlossaries()),semantically equivalent to the old world"Click vocabulary button → open()"single entry point,
// No need to change SettingsHubDialog.jsx Remove placeholder call. Simplify code.
//
// APP_EVENTS.refreshGlossaries (Blueprint Â§0.6) consumed via useAppEvent, calling
// handlers.reload (controller.js bindEvents captured reload handler, included internally,
// try/catch → setStatus error prompt)。

import { useEffect, useRef } from "react";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { APP_EVENTS } from "../../composition/external.js";

export function useGlossariesController() {
  const services = useHomeServices();
  const { feature, view, dialogStore } = services.glossaries;
  const dialogState = useDialogState(dialogStore);
  const viewState = useStoreSnapshot(view.store);
  const open = Boolean(dialogState.open);
  const handlers = view.handlersRef.current;

  useAppEvent(APP_EVENTS.refreshGlossaries, () => {
    handlers?.reload?.();
  });

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
// controller.js open() = openDialog() (dialogStore.open() Idempotent) +
// "Reading glossary..." state + reloadGlossaries() + clear/error state, one-time
// reuse, don't re-implement equivalent logic here.
      void feature?.open?.();
    }
    wasOpenRef.current = open;
  }, [open, feature]);

  return {
    open,
    view: viewState,
    store: view.store,
    feature,
    dialogStore,
    handlers,
  };
}
