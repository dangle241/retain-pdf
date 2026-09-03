// LibraryGrid scroll auto-load (Blueprint §2 features/library/).
//
// Geometry check rewritten from host-actions.js shouldAutoLoadRecentJobs (260px / 0.35
// threshold; not imported——old file is on the "dead (cutover deleted)" list; per Blueprint
// rewritten in-place ~10 lines instead of reusing). Two trigger points, both funnel to the same check():
// 1. Passive scroll listener on scroll container (user manually scrolls to bottom);
// 2. refresh-scheduler.js calls scheduleAutoLoadIfNeeded after each page submission →
//    viewPort.scheduleAutoLoadCheck({isSuspended})——connected via
//    react-view-port.js registerAutoLoadChecker (after content changes, if screen is still not
//    filled, required to auto-load the next page).
//
// loadMore calls uniformly go through viewPort.handlersRef.current.onLoadMore (bindings.js
// binds it to () => runtime.loadRecentJobs({reset:false})), not directly calling
// runtime——keeps same entry point as the "More" button, avoids two parallel loading entries.

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

  // Connect to refresh-scheduler.js → viewPort.scheduleAutoLoadCheck call chain
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




