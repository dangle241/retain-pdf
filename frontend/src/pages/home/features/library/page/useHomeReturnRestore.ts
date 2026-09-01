// Restore state on return to home from reader tab Scroll position.
// - bfcache (pageshow.persisted): DOM Clear cache. pending is sufficient
// - Normal reloadafter list has data apply scroll(avoid height being 0 Write time scrollTop Invalid)

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
 * @param ready Library list populated (or collection/Restore scroll after favorites view mounted.
 */
export function useHomeReturnRestore(ready: boolean) {
  const restoredRef = useRef(false);

  // bfcachebfcache: page restored from cache, scroll position preserved, discard pending Prevent double jump
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
    // Clear invalid scroll to prevent stale data.
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

// Double rAF wait for layout / Set image placeholder first. scrollTop
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHomeReturnScroll(state!);
        // Re-append on async list height increase.
        window.setTimeout(() => applyHomeReturnScroll(state!), 80);
        window.setTimeout(() => applyHomeReturnScroll(state!), 320);
      });
    });
  }, [ready]);
}
