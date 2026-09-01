// CredentialsDialog family (CredentialsDialog/OcrProviderPanels/DeepSeekPanel/
// TaskOptionsPanel) unique assembly face ââ take composition.js credentials domain
// (services.credentials:{feature, view, dialogStore}) Collapse to One hook, component
// Subscribe only to needed slices.,Do not repeat individually useStoreSnapshot/useDialogState Template.
//
// handlers From browser.js (kept controller) Call once synchronously on mount.
// viewPort.bindEvents(...)Captured handler(save/validateOcr/validateDeepSeek/
// changeProvider/resetXxxValidation etc.) ââ see credentials-view-store.js Header comment.

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
