// 主pages → 阅读pages导航(可注入, 便于测试)
//
// 默认"软打开": history.pushState + SoftReaderHost 全屏层, 主pages不卸载.
// replace / 非主pagesDocuments / 跨域: 仍 location.replace|assign.

import { captureHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { trySoftOpenReader } from "../../../../shared/navigation/soft-reader.js";

export type ReaderNavigateOptions = {
  replace?: boolean;
};

export type ReaderNavigateFn = (url: string, options?: ReaderNavigateOptions) => void;

const defaultNavigate: ReaderNavigateFn = (url, { replace = false } = {}) => {
  const target = `${url || ""}`.trim();
  if (!target) return;
  // 记下滚动；软打开时主pagesbooks就不卸, 仍可作兜底
  captureHomeReturnState({ allowBack: !replace });
  // 优先软打开(主pages SPA 仍在时, 即使地址栏已yes reader.html 也能再开)
  if (!replace && trySoftOpenReader(target)) {
    return;
  }
  if (replace) {
    // 深链Start: 尽量软开；Failed再硬进
    if (trySoftOpenReader(target)) {
      return;
    }
    window.location.replace(target);
    return;
  }
  // 独立 reader pages / 跨pages: 整pages进入
  window.location.assign(target);
};

let navigateImpl: ReaderNavigateFn = defaultNavigate;

/** 仅测试使用: 注入假导航, 测完后传 null 复位 */
export function setReaderNavigateForTests(fn: ReaderNavigateFn | null) {
  navigateImpl = fn || defaultNavigate;
}

export function navigateToReader(url: string, options: ReaderNavigateOptions = {}) {
  navigateImpl(url, options);
}



