// Bề mặt lắp ráp duy nhất cho họ GlossariesDialog (GlossariesDialog/GlossaryList/GlossaryEditor/
// GlossaryImportPanel), phản chiếu useCredentialsController.js; gói
// miền glossaries của composition.js (services.glossaries:{feature, view,
// dialogStore}) thành một hook.
//
// Kích hoạt mở: #glossary-btn trong tab "Thuật ngữ" của SettingsHubDialog gọi trực tiếp
// services.glossaries.dialogStore.open() (điểm gọi giữ chỗ §0.4; có hiệu lực khi composition
// sẵn sàng), không qua APP_EVENTS; hook dùng effect chuyển trạng thái open để nối
// việc "hộp thoại được mở" lại với open() của controller.js, bên trong gọi openDialog() +
// reloadGlossaries(); ngữ nghĩa tương đương entry duy nhất cũ "bấm nút thuật ngữ → open()",
// không cần sửa lệnh gọi giữ chỗ hiện có trong SettingsHubDialog.jsx.
//
// APP_EVENTS.refreshGlossaries (bản thiết kế §0.6) được useAppEvent dùng và gọi
// handlers.reload, hàm reload do bindEvents của controller.js bắt, bên trong đã có
// try/catch → thông báo lỗi setStatus.

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
      // open() của controller.js = openDialog() (dialogStore.open() lũy đẳng) +
      // trạng thái "Đang tải bảng thuật ngữ..." + reloadGlossaries() + trạng thái rỗng/lỗi;
      // dùng lại một lần, không ghép lại logic tương đương tại đây.
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
