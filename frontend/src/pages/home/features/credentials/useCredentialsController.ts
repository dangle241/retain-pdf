// Sole assembly surface for CredentialsDialog family (CredentialsDialog/OcrProviderPanels/
// DeepSeekPanel/TaskOptionsPanel) — folds composition.js credentials domain
// (services.credentials:{feature, view, dialogStore}) into one hook; components only
// subscribe to required slices, avoiding repeated useStoreSnapshot/useDialogState boilerplate.
//
// Handlers come from browser.js (kept controller) synced once at mount via
// viewPort.bindEvents(...) capturing handler functions (save/validateOcr/validateDeepSeek/
// changeProvider/resetXxxValidation etc.) — see credentials-view-store.js header comment.

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";

export function useCredentialsController() {
  const services = useHomeServices();
  const { feature, view, dialogStore } = services.credentials;
  const dialogState = useDialogState(dialogStore);
  const viewState = useStoreSnapshot(view.store);
  const credentialsSnapshot = useStoreSnapshot(services.ports.credentialsStatePort.store);

  return {
    open: Boolean(dialogState.open),
    view: viewState,
    credentials: credentialsSnapshot.credentials,
    runtime: credentialsSnapshot.runtime,
    feature,
    dialogStore,
    handlers: view.handlersRef.current,
    tokenInputRef: view.tokenInputRef,
    elementsRef: view.elementsRef,
  };
}



