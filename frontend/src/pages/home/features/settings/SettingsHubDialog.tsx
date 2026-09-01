// SettingsHubDialog v2: 左导航 + 右内容区(原"门厅弹窗"横向 pill 布局退役).
//
// 布局: 左侧竖排导航(图标+名称, Radix Tabs orientation=vertical, 方向键Ready), 
// 右侧内容窗格(每区自带Title行 + 正文, 独立滚动).Appearance区升格为Theme卡片Grid
// 的主舞台；API/Glossary因真实表单仍yes独立顶层对话框(CredentialsDialog/
// GlossariesDialog, 各有 controller/store/测试契约), books面板作为"Start区"
// 保留入口按钮——后续如要内嵌, 动的yes那两个 feature, 不yes这里.
//
// 【测试契约, 改版不许破】(credentials/glossaries/app-update component tests): 
// - #app-settings-dialog / #app-settings-close-btn
// - [data-settings-tab="api|glossary|appearance|update"] 可点击
// - [data-settings-panel=...] forceMount + hidden 属性切换(测试断言 .hidden)
// - #credentials-btn / #glossary-btn 打开对应子对话框
// - Appearance面板 #theme-appearance-panel 与 #theme-option-<id>
//
// 开合Status跨子树走 settings-hub-dialog-store；tab 切换yes子树内瞬态(useState).
// 不 forceMount Dialog 的 Content/Overlay(Radix hideOthers 依赖真实
// mount/unmount, 见 CredentialsDialog 头注释).AppUpdateBanner 的挂载生命
// 周期说明见旧版头注释Conclusion: 后台自检由 composition 的纯逻辑控制器驱动, 
// 与books组件yesno挂载None关.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_SETTINGS_DIALOG_IDS } from "../credentials/credentials-dom-ids.js";
import { AppUpdateBanner } from "../app-update/AppUpdateBanner.jsx";
import { CredentialsWorkbench } from "../credentials/CredentialsWorkbench.jsx";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size 在未注解源Files里被推断为必填;unstyled 路径运行时不用 size.
const Button = ButtonBase as any;

function IconKey(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M14.5 9.5a4 4 0 1 1-1.2 2.86L5 20.65 3.35 19 11.6 10.7A4 4 0 0 1 14.5 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function IconBook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5.5 5.2A2.2 2.2 0 0 1 7.7 3H19v15.5H7.7a2.2 2.2 0 0 0-2.2 2.2V5.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 5.2A2.2 2.2 0 0 0 3.3 3H3v15.5h.3a2.2 2.2 0 0 1 2.2 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function IconPalette(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3a9 9 0 1 0 9 9c0-.5-.04-1-.12-1.48a5 5 0 0 1-6.4-6.4A9 9 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="15.2" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}
function IconUpdate(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v2.1M12 16.9V19M5 12h2.1M16.9 12H19M7.05 7.05l1.5 1.5M15.45 15.45l1.5 1.5M16.95 7.05l-1.5 1.5M8.55 15.45l-1.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const TABS = [
  { id: "api", label: "API Settings", Icon: IconKey },
  { id: "glossary", label: "Glossary", Icon: IconBook },
  { id: "appearance", label: "Appearance", Icon: IconPalette },
  { id: "update", label: "Updates", Icon: IconUpdate },
];

const PANE_HEADS = {
  api: { title: "API Settings", desc: "Configure OCR tokens, DeepSeek keys, model endpoints, and job options. Changes apply after saving." },
  glossary: { title: "Glossary", desc: "Manage fixed translations, reserved terms, and terminology preferences." },
  appearance: { title: "Appearance", desc: "Select a color scheme. Changes take effect immediately and are remembered." },
  update: { title: "Updates", desc: "View the current version and check for updates from GitHub Releases." },
};

function PaneHead({ tab }: { tab: keyof typeof PANE_HEADS }) {
  const head = PANE_HEADS[tab];
  return (
    <header className="app-settings-pane-head">
      <h3>{head.title}</h3>
      <p>{head.desc}</p>
    </header>
  );
}

export function SettingsHubDialog() {
  const services = useHomeServices();
  const { dialogStore } = services.settingsHub;
  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(dialogState.payload?.tab || "api");

  useEffect(() => {
    if (open) {
      setActiveTab(dialogState.payload?.tab || "api");
    }
  }, [open]);

  // API 区内嵌credentials工作台: 进入 api tab 时从credentialsStatus回填表单(不开二层弹窗).
  // forceMount 保证面板已挂载；rAF 再补一次, 避免 ref 尚未挂上导致密码框空白, Save读到空串.
  useEffect(() => {
    if (!open || activeTab !== "api") {
      return;
    }
    const prepare = () => services.credentials?.feature?.prepareCredentialsPanels?.();
    prepare();
    const raf = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(raf);
  }, [open, activeTab, services]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  function openGlossaries() {
    services.glossaries.dialogStore.open();
  }

  function panelClass(tab: string) {
    // 纯字面量拼接(含空格separated), 避开 v4 扫描器的 `x${y}` 模板坑
    return activeTab === tab ? "app-settings-panel is-current" : "app-settings-panel";
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={APP_SETTINGS_DIALOG_IDS.dialog}
          className="desktop-dialog app-settings-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell app-settings-shell">
            <TabsPrimitive.Root
              className="app-settings-layout"
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <aside className="app-settings-rail">
                <DialogPrimitive.Title asChild>
                  <h2>Settings</h2>
                </DialogPrimitive.Title>
                <TabsPrimitive.List className="app-settings-nav" aria-label="SettingsCategory">
                  {TABS.map(({ id, label, Icon }) => (
                    <TabsPrimitive.Trigger
                      key={id}
                      value={id}
                      className={activeTab === id ? "is-active" : ""}
                      data-settings-tab={id}
                    >
                      <Icon />
                      {label}
                    </TabsPrimitive.Trigger>
                  ))}
                </TabsPrimitive.List>
              </aside>

              <div className="app-settings-pane">
                <DialogPrimitive.Close asChild>
                  <Button
                    id={APP_SETTINGS_DIALOG_IDS.closeButton}
                    className="dialog-close-btn app-settings-close"
                    aria-label="Close"
                  >
                    ×
                  </Button>
                </DialogPrimitive.Close>

                <TabsPrimitive.Content
                  value="api"
                  forceMount
                  hidden={activeTab !== "api"}
                  className={panelClass("api")}
                  data-settings-panel="api"
                >
                  <PaneHead tab="api" />
                  {/* credentials工作台直接内嵌(None二层弹窗)；与First-run setup门total用
                      CredentialsWorkbench, Status同源. */}
                  <CredentialsWorkbench />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="glossary"
                  forceMount
                  hidden={activeTab !== "glossary"}
                  className={panelClass("glossary")}
                  data-settings-panel="glossary"
                >
                  <PaneHead tab="glossary" />
                  <div className="app-settings-launcher">
                    <p>
                      Glossaries define fixed translations and reserved terms. You can maintain multiple glossaries and
                      enable them as needed; they apply when translation jobs start.
                    </p>
                    <Button id={APP_SETTINGS_DIALOG_IDS.glossaryButton} className="app-settings-action" onClick={openGlossaries}>
                      Open Glossary
                    </Button>
                  </div>
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="appearance"
                  forceMount
                  hidden={activeTab !== "appearance"}
                  className={panelClass("appearance")}
                  data-settings-panel="appearance"
                >
                  <PaneHead tab="appearance" />
                  <ThemeAppearancePanel />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="update"
                  forceMount
                  hidden={activeTab !== "update"}
                  className={panelClass("update")}
                  data-settings-panel="update"
                >
                  <PaneHead tab="update" />
                  {/* AppUpdateBanner:按钮 + 详情 dialog 合并一体(蓝图 §5).
                      挂载生命周期与后台自检解耦的Conclusion见Files头注释. */}
                  <AppUpdateBanner />
                </TabsPrimitive.Content>
              </div>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}





