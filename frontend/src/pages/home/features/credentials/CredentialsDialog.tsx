// CredentialsDialog(React 版 <browser-credentials-dialog>,Side-by-side
// components/dialogs/browser-credentials-dialog.js 逐 id 镜像 + browser.js
// (kept 控制器)的开合/校验/Save编排).
//
// Dialog Rendering层(Stage C,shadcn 改造):从原生 <dialog>+showModal/close 换成
// radix-ui 的 Dialog 原语(DialogPrimitive.Root/Portal/Overlay/Content),不经
// src/components/ui/dialog.jsx 那层默认皮肤(className 继续用现有的
// desktop-dialog/desktop-shell 这套 bespoke CSS).open 受控于
// credentialsDialogStore(useCredentialsController 的 open),onOpenChange
// 在 next===false 时统一调用 dialogStore.close()——Escape, 点击背板
// (DialogPrimitive.Overlay 之外的 outside-click 检测), 点击Close按钮
// (DialogPrimitive.Close)三entries路径都走这一个回调,不required再手写
// handleBackdropClick/keydown 监听.
//
// 不 forceMount Content/Overlay:Radix modal Content 内部有一个
// hideOthers(content)(aria-hidden 兄弟节点)的 effect,依赖组件的真实
// mount/unmount 生命周期(deps=[]),forceMount 会让它在对话框从未打开时就
// 永久生效——反而制造新的None障碍缺陷.已确认对话框Close时 OCR/DeepSeek/任务
// 选items的未Save草稿会随之丢失(输入yes非受控 ref,组件卸载即重置),但没有
// 测试/产品语义要求"Close后保留未Save草稿",这yes可接受的, 更符合直觉的
// Dialog UX(草稿在Save前不持久).
//
// 打开入口: APP_EVENTS.openBrowserCredentials
// - setupMode=true → books弹窗(First-run setup门, 独立"API Settings")
// - 其余情况 → Settings中心 API 区(唯一常规填 Key 入口, 避免双窗口)
// HeroUpload 门禁, AI 缺 Key 横幅, 提交流都走同一Events.
//
// Tabs 实现(Stage B,shadcn 改造):同 SettingsHubDialog.jsx 的Select——直接用
// radix-ui 的 Tabs 原语,不经 src/components/ui/tabs.jsx 默认皮肤(避免和
// credential-tabs/credential-panel 这套 bespoke CSS 冲突).activeTab 由
// useCredentialsController 的 view.activeTab 驱动(不yesbooks组件自己的
// useState),Radix 走受控模式:value={activeTab} +
// onValueChange={feature.activateCredentialTab}——原books挂在每个 trigger 上的
// onClick 收敛成 Root 级别一个回调,行为不变.
//
// TaskOptionsPanel 常驻挂载(不随 tab 卸载,见下方 JSX 内联注释)这entries既有
// 约束继续保留:TabsPrimitive.Content 的 forceMount + 显式 hidden 覆盖(Radix
// 内部会算一份 hidden,但 contentProps 展开顺序在其后,我们自己传的 hidden
// 值最终生效),语义与原来手写的 hidden 属性完全一致——这entries只在对话框处于
// 打开态时才有意义(对话框Close时 Content 整体卸载,tab 常驻挂载None从谈起).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CredentialsWorkbench } from "./CredentialsWorkbench.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";
import { APP_EVENTS } from "../../composition/external.js";

// Button.size 在未注解源Files里被推断为必填;unstyled 路径运行时不用 size.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsDialog() {
  const { open, view, feature, dialogStore } = useCredentialsController();
  const services = useHomeServices();
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    // 常规: 只打开"Settings → API Settings"；仅First-run setup走独立弹窗
    if (detail.setupMode) {
      feature?.openBrowserCredentialsDialog({ setupMode: true });
      return;
    }
    services.settingsHub?.dialogStore?.open?.({ tab: "api" });
  });

  // Esc / 背板点击 / Close按钮都经这一个回调回写 store(dialogStore.close()
  // 对已CloseStatusyes幂等 no-op,和 handlers.save() 内部调用 viewPort.closeDialog()
  // 不会冲突).
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
            {/* 表单主体抽到 CredentialsWorkbench(与 SettingsHubDialog API 区
                total用同一实现), books弹窗只剩First-run setup门(setupMode)一个场景. */}
            <div className="desktop-body credential-dialog-body">
              <CredentialsWorkbench />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}





