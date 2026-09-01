// GlossariesDialog 家族(GlossariesDialog/GlossaryList/GlossaryEditor/
// GlossaryImportPanel)的唯一装配面(镜像 useCredentialsController.js)——把
// composition.js 的 glossaries 域(services.glossaries:{feature, view,
// dialogStore})折成一个 hook。
//
// 打开触发:SettingsHubDialog"词表"tab 的 #glossary-btn 直接调
// services.glossaries.dialogStore.open()(蓝图 §0.4 占位调用点,composition
// 就位后即生效),不经 APP_EVENTS——本 hook 用一个 open 状态迁移 effect 把
// "对话框被打开"这件事接回 controller.js 的 open()(内部会 openDialog() +
// reloadGlossaries()),语义等价旧世界"点击词表按钮 → open()"的单一入口,
// 不需要改 SettingsHubDialog.jsx 的既有占位调用。
//
// APP_EVENTS.refreshGlossaries(蓝图 §0.6)用 useAppEvent 消费,调用
// handlers.reload(controller.js bindEvents 捕获的 reload 处理函数,内部已带
// try/catch → setStatus 错误提示)。

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
      // controller.js 的 open() = openDialog()(dialogStore.open() 幂等) +
      // "正在读取术语表..." 状态 + reloadGlossaries() + 清空/错误状态,一次性
      // 复用,不在这里重新拼一遍等价逻辑。
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
