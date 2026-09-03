// GlossariesDialog family (GlossariesDialog/GlossaryList/GlossaryEditor/
// GlossaryImportPanel) single assembly surface (mirrors useCredentialsController.js) —
// folds the glossaries domain from composition.js (services.glossaries:{feature, view,
// dialogStore}) into one hook.
//
// Open trigger: SettingsHubDialog "Glossary" tab's #glossary-btn directly calls
// services.glossaries.dialogStore.open() (blueprint §0.4 placeholder call site,
// effective once composition is in place), bypassing APP_EVENTS — this hook uses an
// open state-migration effect to pipe "dialog opened" back to controller.js's open()
// (which internally calls openDialog() + reloadGlossaries()), semantically equivalent to
// the old-world single entry point "click Glossary button → open()", no change required
// to SettingsHubDialog.jsx's existing placeholder call.
//
// APP_EVENTS.refreshGlossaries (blueprint §0.6) consumed via useAppEvent, calling
// handlers.reload (the reload handler captured by controller.js's bindEvents, which
// already carries try/catch → setStatus error feedback).

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
      // controller.js's open() = openDialog() (dialogStore.open() idempotent) +
      // "Loading glossary..." status + reloadGlossaries() + clear/error status, all in one shot;
      // reused; not re-assembling equivalent logic here.
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



