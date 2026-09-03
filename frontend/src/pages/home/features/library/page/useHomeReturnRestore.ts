// After returning from Reader to main page: resume tab scroll position.
// - bfcache (pageshow.persisted): DOM intact, just clear pending
// - Normal reload: apply scroll only after List has data (avoid scrollTop being a no-op when height is 0)

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
 * @param ready Resume scroll only when LibraryList has content (or Collection/FavoriteView is mounted)
 */
export function useHomeReturnRestore(ready: boolean) {
  const restoredRef = useRef(false);

  // bfcache: entire page restored from cache, scroll position preserved, drop pending to avoid double jump
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
    // Clear even for no-op scroll to avoid dirty data
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

    // Double rAF: wait for layout / image placeholders before setting scrollTop
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHomeReturnScroll(state!);
        // Supplementary pass when List height increases in steps
        window.setTimeout(() => applyHomeReturnScroll(state!), 80);
        window.setTimeout(() => applyHomeReturnScroll(state!), 320);
      });
    });
  }, [ready]);
}




