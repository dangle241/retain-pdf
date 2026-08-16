// Bề mặt lắp ráp duy nhất cho họ CredentialsDialog (CredentialsDialog/OcrProviderPanels/DeepSeekPanel/
// TaskOptionsPanel): gói miền credentials của composition.js
// (services.credentials:{feature, view, dialogStore}) thành một hook; thành phần
// chỉ đăng ký lát cần thiết, không lặp mẫu useStoreSnapshot/useDialogState.
//
// handlers đến từ lệnh gọi đồng bộ một lần khi mount của browser.js, bộ điều khiển được giữ,
// được viewPort.bindEvents(...) bắt gồm save/validateOcr/validateDeepSeek/
// changeProvider/resetXxxValidation, v.v.; xem chú thích đầu credentials-view-store.js.

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
