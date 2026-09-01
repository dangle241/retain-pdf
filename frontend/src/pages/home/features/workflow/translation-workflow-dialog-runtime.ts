import {
  APP_EVENTS,
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";
import type { TranslationWorkflowDialogStatePort } from "../../composition/external.js";

// Translation工作流对话框 runtime(React 世界版控制器).
//
// 复用纯逻辑:state.js 的 dialogStatePort(store 驱动开合/模式,并sync home
// viewMode), contract.js 的模式常量, status-area-port 契约.旧 controller.js
// 的 DOM 绑定(dialogElement/closeButton addEventListener)由 React 组件的
// onClick 取代,这里只保留 document 级Events桥.
//
// Events契约(蓝图风险 5,不可破坏):
// - 用户侧开合入口(添加按钮 / Close按钮 / 背板 / Escape)一律先 dispatch
//   APP_EVENTS.openTranslationWorkflow / closeTranslationWorkflow,再由books
//   runtime 的 document 监听统一落Status——3b recent-jobs 的库刷新挂起/resume
//   (bindings.js)与 app-actions 提交Workflow都依赖这两个Events在 document 上可见.
// - translationWorkflowSync / statusAreaVisibilityChanged → sync模式.

export interface TranslationWorkflowStatusAreaPort {
  isVisible?: () => boolean;
  hide?: () => void;
  returnHome?: () => void;
}

export interface TranslationWorkflowUploadSessionPort {
  resetUploadSession?: () => void;
}

export interface CreateTranslationWorkflowDialogRuntimeOptions {
  dialogStatePort?: TranslationWorkflowDialogStatePort;
  statusAreaPort?: TranslationWorkflowStatusAreaPort;
  uploadSessionPort?: TranslationWorkflowUploadSessionPort | null;
  documentRef?: Document;
}

export interface OpenTranslationWorkflowEventDetail {
  mode?: string;
}

export type OpenTranslationWorkflowEventLike = Event | {
  detail?: OpenTranslationWorkflowEventDetail;
};

export function createTranslationWorkflowDialogRuntime({
  dialogStatePort,
  statusAreaPort,
  uploadSessionPort = null,
  documentRef = globalThis.document,
}: CreateTranslationWorkflowDialogRuntimeOptions = {}) {
  // 3b 修复(实测found,非预先设计):recent-jobs 的 refresh-environment.js
  // 默认 isWorkflowOpen 读的yes #translation-workflow-dialog 的 data-open
  // 属性(DOM),不yes任何 store——而 React 的 DOM 提交相对 store 写入yes异step的.
  // close() 触发的"store 写入 → bindings.js 的 closeTranslationWorkflow 监听器
  // 读 DOM 判断 isSuspended()"All发生在同一个syncEvents派发调用栈内,此时 React
  // 还没来得及重渲提交新的 data-open,DOM 读到的仍yes打开前的旧值——实测复现为
  // "Close工作流对话框后库刷新永久卡死"(蓝图风险 5 的具体翻车形态).
  // mountRecentJobsFeature 未开放 environment 注入口(见 composition.js 里的
  // 说明),没法从Upstream注入读 store 的 isWorkflowOpen,只能反过来:在 store 写入
  // 的同一拍,把这个属性也sync写一份到 DOM,消除给 DOM 读方的竞态窗口.
  // React 之后仍会按自己的节奏把同一个值再渲一遍(幂等,None副作用).
  function syncOpenAttributeToDom(open: boolean) {
    const dialogEl = documentRef?.getElementById?.(TRANSLATION_WORKFLOW_DIALOG.ids.dialog);
    if (dialogEl?.dataset) {
      dialogEl.dataset.open = open
        ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
        : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed;
    }
  }
  function resolveMode(mode?: string) {
    if (mode === TRANSLATION_WORKFLOW_MODES.STATUS || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      return mode;
    }
    return statusAreaPort?.isVisible?.()
      ? TRANSLATION_WORKFLOW_MODES.STATUS
      : TRANSLATION_WORKFLOW_MODES.UPLOAD;
  }

  function isOpen() {
    return Boolean(dialogStatePort.getSnapshot().open);
  }

  // ---- Status落地(document 监听调用;镜像旧 controller 的 openUpload/openFromEvent/close/sync) ----

  function openUpload() {
    statusAreaPort?.hide?.();
    uploadSessionPort?.resetUploadSession?.();
    dialogStatePort.open(TRANSLATION_WORKFLOW_MODES.UPLOAD);
    syncOpenAttributeToDom(true);
  }

  function openFromEvent(event: OpenTranslationWorkflowEventLike = {} as OpenTranslationWorkflowEventLike) {
    const detail = (event as { detail?: OpenTranslationWorkflowEventDetail })?.detail;
    const mode = detail?.mode;
    if (!mode || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      openUpload();
      return;
    }
    dialogStatePort.open(resolveMode(mode));
    syncOpenAttributeToDom(true);
  }

  function close() {
    dialogStatePort.close();
    syncOpenAttributeToDom(false);
  }

  function sync() {
    dialogStatePort.setMode(resolveMode());
  }

  // ---- 用户侧入口(React 组件调用;只发Events,不直接改Status) ----

  function dispatch(eventName: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
    }
  }

  function requestOpenUpload() {
    dispatch(APP_EVENTS.openTranslationWorkflow, { mode: TRANSLATION_WORKFLOW_MODES.UPLOAD });
  }

  // Close = 直接关对话框,一次点击到位(不管CurrentyesUpload态还yesJob Progress态).
  //
  // 旧的"两段式Close"(Status可见时先 returnHome, 对话框不关,再点一次才真关)被
  // 用户判定为不符合预期:点Job Progress的 × 会先弹回"Translation PDF"空Upload表单, 还顺带
  // 悄悄 stopPolling 把任务重置掉,像yes"点Close反而退回上一step".现在统一成"× =
  // Close".想中止运行中的任务有 StatusCard 上专门的"Cancel任务"按钮
  // (cancelCurrentJob),不靠Close对话框来兼职做这件事.
  //
  // Close不影响后台任务:job-runtime 轮询独立于对话框挂载生命周期,任务到终态
  // 时 controller.js 会自己 pollingPort.stop()(见该Files §renderJob),不会因为
  // 关了对话框就漏掉一个常驻轮询;LibraryGrid的卡片仍会Display该任务的LiveProgress.
  function requestClose() {
    dispatch(APP_EVENTS.closeTranslationWorkflow);
  }

  function bindEvents() {
    if (!documentRef?.addEventListener) {
      return () => {};
    }
    const bindings: Array<[string, EventListener]> = [
      [APP_EVENTS.openTranslationWorkflow, openFromEvent as unknown as EventListener],
      [APP_EVENTS.closeTranslationWorkflow, close as EventListener],
      [APP_EVENTS.translationWorkflowSync, sync as EventListener],
      [APP_EVENTS.statusAreaVisibilityChanged, sync as EventListener],
    ];
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen()) {
        requestClose();
      }
    };
    bindings.forEach(([name, handler]) => documentRef.addEventListener(name, handler));
    documentRef.addEventListener("keydown", onKeydown);
    return () => {
      bindings.forEach(([name, handler]) => documentRef.removeEventListener(name, handler));
      documentRef.removeEventListener("keydown", onKeydown);
    };
  }

  return {
    bindEvents,
    close,
    isOpen,
    openFromEvent,
    openUpload,
    requestClose,
    requestOpenUpload,
    statePort: dialogStatePort,
    sync,
  };
}





