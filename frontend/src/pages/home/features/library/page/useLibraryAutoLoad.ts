// Library grid scroll auto-load (Blueprint Â§2 features/library).
//
// Geometric predicate rewritten from host-actions.js shouldAutoLoadRecentJobs (260px / 0.35
// Threshold, do not import â Old file attributes "dead (delete on cutover)" list, rewrite in-place per blueprint spec.
// ~10 Line, not reuse)Two trigger ports.,All converge to the same one. check():
// 1. scroll container's passive scroll listener (User scrolled to bottom manually);
// 2. refresh-scheduler.js Called after each paginated submission. scheduleAutoLoadIfNeeded →
//    viewPort.scheduleAutoLoadCheck({isSuspended})——via
//    react-view-port.js registerAutoLoadChecker Connect. (If content changes
//    Not enough content.,Auto-load next page.)。
//
// loadMore use unified call via viewPort.handlersRef.current.onLoadMore(bindings.js
// Bound to () => runtime.loadRecentJobs({reset:false})),Do not call directly.
// runtime——Keep consistent with"More"Buttons share same copy.,Avoid duplicate loading entry points.

import { useCallback, useEffect } from "react";

const THRESHOLD_PX = 260;
const THRESHOLD_RATIO = 0.35;

export function useLibraryAutoLoad({ scrollBodyRef, hasMore, loadMoreLoading, viewPort }: any) {
  const check = useCallback(({ isSuspended }: any = {}) => {
    if (isSuspended?.() ?? viewPort.handlersRef.current.isSuspended?.()) {
      return;
    }
    if (!hasMore || loadMoreLoading) {
      return;
    }
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return;
    }
    const remaining = scrollBody.scrollHeight - scrollBody.scrollTop - scrollBody.clientHeight;
    const threshold = Math.max(THRESHOLD_PX, scrollBody.clientHeight * THRESHOLD_RATIO);
    if (remaining < threshold) {
      viewPort.handlersRef.current.onLoadMore?.();
    }
  }, [hasMore, loadMoreLoading, scrollBodyRef, viewPort]);

// Integrate refresh-scheduler.js â viewPort.scheduleAutoLoadCheck call chain
  useEffect(() => viewPort.registerAutoLoadChecker(check), [viewPort, check]);

  // Passive listener on scroll container itself
  useEffect(() => {
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return undefined;
    }
    const onScroll = () => {
      if (viewPort.handlersRef.current.isSuspended?.()) {
        return;
      }
      requestAnimationFrame(() => check());
    };
    scrollBody.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollBody.removeEventListener("scroll", onScroll);
  }, [scrollBodyRef, viewPort, check]);
}
