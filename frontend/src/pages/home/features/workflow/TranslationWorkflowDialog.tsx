// Translation工作流对话框 —— 仅"Add PDF"Upload入口使用.
//
// 书booksJob Progress / Start translation已迁到Book Details"Translation"Tab: 
//   BookTranslationWorkflowPanel(#book-detail-status-section)
// 勿再把已有 document 的Progress抬进books弹窗；selectJob 有 document_id 时会打开详情.
//
// Dialog Rendering层(Stage C 第二batches,shadcn 改造):从 bespoke <div role="dialog">
// 换成 radix-ui 的 Dialog 原语(DialogPrimitive.Root/Portal/Overlay/Content).
// 相比Stage C 第一batches(CredentialsDialog 等 4 个,dialog-store.js 工厂 + 单态
// Close语义)结构上有三处不同,逐一说明:
//
// 1. 开合Status源不yes dialog-store.js 工厂,yes bespoke createStore 包装的
//    dialogStatePort({open,mode})——services.stores.dialog 快照.booksFiles不改
//    这层(铁律),只换Rendering.
//
// 2. 两态语义(dialog.mode: UPLOAD/STATUS)yes对话框*内部*Status,不yes Radix 的
//    open/close——mode 只影响Title文案和 statusMode/uploadMode 两个 class,
//    与books次迁移正交,原样保留.
//
// 3. Close统一路由到 requestClose():Escape/背板/Close按钮三entries触发路径都必须走
//    services.workflowDialog.requestClose()(见 translation-workflow-dialog-
//    runtime.js),不能有任何一entries绕过去直接调 dialogStatePort.close()——3b 库
//    刷新挂起/resume(bindings.js)依赖 closeTranslationWorkflow Events在 document
//    上可见,只有走 requestClose() 才会 dispatch 这个Events.
//
//    requestClose() 现在yes"一次点击直接Close"(不再yes早期的两段式:Status可见时
//    先 returnHome, 对话框不关).两段式被用户判定为不符合预期(点Job Progress的
//    × 会弹回空Upload表单, 还顺带 stopPolling 把任务重置),已改成 × = Close;
//    中止任务改由 StatusCard 的"Cancel任务"按钮负责.
//
//    Escape 键仍需额外处理:books对话框有一entries独立的 document 级 keydown 监听
//    (runtime 的 bindEvents,Events契约要它在 document 上可见,不能删),已经在
//    调 requestClose().若同时让 Radix Content 的 onEscapeKeyDown 走默认行为
//    (触发 onOpenChange(false) → requestClose()),一次 Escape 会触发两次
//    requestClose(),两次 closeTranslationWorkflow Events会让 bindings.js 的
//    挂起/resume逻辑重复跑一遍.这里显式 onEscapeKeyDown={(e)=>e.preventDefault()}
//    把 Escape 完全交给既有 document 监听器处理——DismissableLayer 的 keydown
//    挂在 capture Stage, bindEvents 挂在 bubble Stage,前者先跑并被我们
//    preventDefault(),Radix 自己的 onDismiss 被跳过,随后 bubble Stage bindEvents
//    正常触发一次 requestClose(),三entries路径最终都恰好调用一次,不重复.
//
// 4. 不 forceMount Content(同其余对话框的决策, 见 use-dialog-return-focus.js
//    头注释——forceMount 会让 Radix modal Content 内部的 hideOthers() 副作用
//    在应用Start时就永久生效).WorkflowPanel(Upload表单)和 #status-section(3b
//    StatusCard)因此随对话框Close一起卸载.openUpload() 每次打开都Noneentries件
//    resetUploadSession(),不存在跨开合保留Upload态的预期;job-runtime 轮询引擎
//    yes独立于 React 挂载生命周期的服务(store 驱动,不依赖 StatusCard yesno挂载),
//    卸载 StatusCard 不影响后台轮询——任务到终态时引擎自己 stopPolling,Close
//    对话框不会漏掉常驻轮询.
//
// <html> 级样式钩子(rootOpen class)在 React 根之外,用 effect sync(卸载时
// 清理),保持不动.触发按钮("添加",在 LibraryBottomBar 里)与books对话框跨
// 子树, Radix 默认的 triggerRef 焦点归还机制失效, 复用
// use-dialog-return-focus.js(同 CredentialsDialog 等的先例).

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { WorkflowPanel } from "./WorkflowPanel.jsx";
import { StatusCard } from "../status/StatusCard.jsx";
import {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";

export function TranslationWorkflowDialog() {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const statusArea = useStoreSnapshot(services.stores.statusArea);

  const open = Boolean(dialog.open);
  const statusMode = dialog.mode === TRANSLATION_WORKFLOW_MODES.STATUS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // <html> 级样式钩子在 React 根之外,用 effect sync(卸载时清理)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen, open);
    return () => root.classList.remove(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen);
  }, [open]);

  const contentClasses = [
    "translation-workflow-dialog",
    statusMode
      ? TRANSLATION_WORKFLOW_DIALOG.classes.statusMode
      : TRANSLATION_WORKFLOW_DIALOG.classes.uploadMode,
  ].join(" ");

  // Escape(见头注释Page 3 点, 这里只 preventDefault, 实际Close由既有 document
  // 监听器处理)/ 背板点击(DismissableLayer 的 outside-click 检测)/ Close按钮
  // (DialogPrimitive.Close)最终都统一路由到 requestClose() 的两段式Close判断
  // (Status可见先 returnHome, no则才真正 close), 不直接调
  // dialogStatePort/dialogStore 的 close().
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.workflowDialog.requestClose();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="translation-workflow-overlay" />
        <DialogPrimitive.Content
          id={TRANSLATION_WORKFLOW_DIALOG.ids.dialog}
          className={contentClasses}
          data-open={TRANSLATION_WORKFLOW_DIALOG.datasetValues.open}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="desktop-shell translation-workflow-shell">
            <div className="translation-workflow-head">
              <div className="translation-workflow-head-copy">
                <DialogPrimitive.Title asChild>
                  <h2 id={TRANSLATION_WORKFLOW_DIALOG.ids.title}>
                    {statusMode
                      ? TRANSLATION_WORKFLOW_DIALOG.copy.statusTitle
                      : TRANSLATION_WORKFLOW_DIALOG.copy.uploadTitle}
                  </h2>
                </DialogPrimitive.Title>
                {!statusMode ? (
                  <DialogPrimitive.Description asChild>
                    <p id="translation-workflow-desc" className="translation-workflow-desc">
                      {TRANSLATION_WORKFLOW_DIALOG.copy.uploadDescription}
                    </p>
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  id={TRANSLATION_WORKFLOW_DIALOG.ids.closeButton}
                  type="button"
                  className="dialog-close-btn"
                  aria-label="Close"
                >
                  ×
                </button>
              </DialogPrimitive.Close>
            </div>
            <WorkflowPanel />
            <section
              id="status-section"
              className={`translation-status-panel${statusArea.visible ? "" : " hidden"}`}
              aria-label="Job Progress"
            >
              {/* status 侧 props 默认值在另一batches收紧;此处补齐调用侧以满足Current签名 */}
              <StatusCard
                visible={statusArea.visible}
                showResultActions
                showHiddenContract
                rootId="job-status-card"
              />
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}




