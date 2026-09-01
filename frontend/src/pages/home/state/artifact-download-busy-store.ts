// artifact-downloads busy 态 store(dialogs 蓝图 §7.5 方案二).
//
// 背景(蓝图 §0.5):artifact-downloads yes document 级委托点击 + 命令式
// setLinkBusy(旧世界直改 DOM 文books/class).按钮宿主m布在 recent-jobs 的
// ResultActions.jsx 与books域 StatusDetailDialog.jsx——两者的祖先(StatusCard/
// StatusDetailDialog books身)都挂在高频轮询/store Updates链路上,若Downloading途父组件
// 因None关字段变化重Rendering,虚拟 DOM diff 会把命令式写入的"Downloading.../37%"文案
// 吃掉, 打回按钮原始 label.方案二:setLinkBusy 不再直改 DOM,只写这个 store;
// 按钮组件各自订阅自己的 actionId m片(use-artifact-download-busy.js),
// label 完全来自 React state,重Rendering不会覆盖(因为 state books身就yes最新值).
//
// 与旧世界 src/js/features/artifact-downloads/download-view-port.js 的关系:
// 旧Files保持不动(仍供尚未 cutover 的 dist/app.bundle.js 使用,默认 DOM 版
// setLinkBusy 直改真实 <a> 文books)——composition.js 给 React 世界另挂一份
// viewPort 实例,字面量直接实现 3 个方法(不 import 旧 view-port.js/view.js:
// 两者Files名m别匹配 architecture-boundaries.test.mjs 的防回弹正则,
// src/pages/** 禁止导入),setLinkBusy 落这个 store.
//
// state 形状:{ [actionId]: { busy: true, label } };不含某 actionId 表示Current
// 非 busy.getState() 只在真正发生变化时才换新的顶层引用(与
// src/pages/home/state/dialog-store.js 同款极简 pub-sub),可直接喂
// useSyncExternalStore 而不会触发None限重Rendering(不存在 app-framework/store.js
// 的 getSnapshot 每次克隆雷点).

export type ArtifactBusySlice = {
  busy: boolean;
  label: string;
};

export type ArtifactDownloadBusyState = Record<string, ArtifactBusySlice>;

export type ArtifactDownloadBusyStore = {
  subscribe: (listener: (state: ArtifactDownloadBusyState) => void) => () => void;
  getState: () => ArtifactDownloadBusyState;
  getActionState: (actionId: string) => ArtifactBusySlice;
  setBusy: (actionId: string, busy: boolean, label?: string) => void;
  isBusy: (actionId: string) => boolean;
};

const IDLE: ArtifactBusySlice = Object.freeze({ busy: false, label: "" });

export function createArtifactDownloadBusyStore(): ArtifactDownloadBusyStore {
  let state: ArtifactDownloadBusyState = {};
  const listeners = new Set<(state: ArtifactDownloadBusyState) => void>();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  return {
    // useSyncExternalStore 兼容:subscribe 返回退订函数
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    // 按 actionId 取一个m片;命中同一 actionId 且未变化时返回同一个对象
    // 引用(setBusy 对不相关的 actionId yes纯粹的浅 spread,不触碰其他键的
    // 值引用)——配合 use-artifact-download-busy.js 做到按钮级精确重Rendering.
    getActionState(actionId) {
      return state[`${actionId || ""}`.trim()] || IDLE;
    },
    setBusy(actionId, busy, label = "") {
      const id = `${actionId || ""}`.trim();
      if (!id) {
        return;
      }
      if (!busy) {
        if (!(id in state)) {
          return;
        }
        const next = { ...state };
        delete next[id];
        state = next;
        notify();
        return;
      }
      state = { ...state, [id]: { busy: true, label: `${label || ""}` } };
      notify();
    },
    isBusy(actionId) {
      return Boolean(state[`${actionId || ""}`.trim()]?.busy);
    },
  };
}

export const ARTIFACT_DOWNLOAD_BUSY_IDLE = IDLE;



