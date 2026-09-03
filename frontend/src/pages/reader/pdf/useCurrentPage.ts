// Estimates the current page (1-based) based on the reading focus line within the shared scroll shell.
// Uses the same pickPageAtFocus rule as measurePageScrollProgress / scroll anchors.

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import {
  pageSelector,
  type ReaderPaneId,
} from "./reader-dom-contract.js";
import {
  pickPageAtFocus,
  readingFocusY,
} from "./scroll-to-page.js";

export function useCurrentPage(
  scrollRef: RefObject<HTMLElement | null>,
  numPages: number,
  enabled = true,
  /** Re-bind when zoom / mode changes cause node changes */
  observeKey: string | number = "",
  /** Only look at pages of a specific column; empty means all */
  pane?: ReaderPaneId | null,
): number {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!enabled || numPages <= 0) {
      setCurrentPage(1);
      return;
    }
    const root = scrollRef.current;
    if (!root) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;

    const selector = pageSelector(undefined, pane);

    const measure = () => {
      if (cancelled) return;
      const pages = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!pages.length) {
        return;
      }
      const focusY = readingFocusY(root);
      const picked = pickPageAtFocus(pages, focusY);
      if (picked) {
        setCurrentPage(picked.page);
      }
    };

    const scheduleMeasure = () => {
      if (cancelled) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };

    const attach = () => {
      if (cancelled) return;
      const pages = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!pages.length) {
        retryTimer = setTimeout(attach, 120);
        return;
      }
      measure();
      root.addEventListener("scroll", scheduleMeasure, { passive: true });
    };

    attach();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      root.removeEventListener("scroll", scheduleMeasure);
    };
  }, [scrollRef, numPages, enabled, observeKey, pane]);

  return currentPage;
}



