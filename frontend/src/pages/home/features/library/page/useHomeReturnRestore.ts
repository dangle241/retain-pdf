// 从Reader返回主pages后: resume tab 滚动位置.
// - bfcache(pageshow.persisted): DOM 完好, 清掉 pending 即可
// - 普通 reload: List有Data后再 apply scroll(避免高度为 0 时写 scrollTop None效)

import { useEffect, useRef } from "react";
import {
  applyHomeReturnScroll,
  clearHomeReturnState,
  consumeHomeReturnState,
  peekHomeReturnState,
  type HomeReturnState,
} from "../../../../../shared/navigation/home-return-state.js";

export function readInitialLibraryTabFromReturn(): string {
  const state = peekHomeReturnState();
  const tab = `${state?.activeTab || ""}`;
  if (
    tab === "categories"
    || tab === "favorites"
    || tab === "library"
    || tab === "ask"
  ) {
    return tab;
  }
  return "library";
}

/**
 * @param ready LibraryList已有内容(或Collection/FavoriteView已挂载)时再resume滚动
 */
export function useHomeReturnRestore(ready: boolean) {
  const restoredRef = useRef(false);

  // bfcache: 整pages从缓存唤起, 滚动books来就在, 丢掉 pending 避免二次跳动
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        clearHomeReturnState();
        restoredRef.current = true;
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!ready || restoredRef.current) return;

    let state: HomeReturnState | null = peekHomeReturnState();
    if (!state) {
      restoredRef.current = true;
      return;
    }
    // None有效滚动也清掉, 避免脏Data
    if (
      state.libraryScrollTop <= 0
      && state.panelScrollTop <= 0
      && state.windowScrollY <= 0
    ) {
      clearHomeReturnState();
      restoredRef.current = true;
      return;
    }

    restoredRef.current = true;
    state = consumeHomeReturnState();
    if (!state) return;

    // 双 rAF: 等布局 / 图片占位后再设 scrollTop
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHomeReturnScroll(state!);
        // List异step增高时再补一次
        window.setTimeout(() => applyHomeReturnScroll(state!), 80);
        window.setTimeout(() => applyHomeReturnScroll(state!), 320);
      });
    });
  }, [ready]);
}




