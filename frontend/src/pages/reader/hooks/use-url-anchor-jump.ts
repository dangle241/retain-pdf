// URL anchor → react-pdf jump to page.
//
// Favorite / search / citation jump-back adds ?page_idx=&block_id= to the URL (page_idx is 0-based).
// The legacy engine uses scheduleAnchorJump in boot; the default react-pdf path previously only
// void resolveReaderAnchor(), which is a no-op. This hook, once the PDF is ready and the total
// page count is known, jumps to page_idx+1, and uses short delays to retry while waiting for
// the page slot layout.
//
// block_id: react-pdf has no region layer yet, only page-level jumps.

import { useEffect, useRef } from "react";
import { resolveReaderAnchor } from "../external.js";

export type UrlReaderAnchor = {
  pageIdx: number | null;
  blockId: string;
};

/** page_idx (0-based) → Reader page number (1-based); invalid returns null */
export function pageNumberFromUrlAnchor(
  anchor: UrlReaderAnchor | null | undefined,
): number | null {
  if (!anchor) return null;
  // Do not Number(null)===0, otherwise "block_id only" would be misread as Page 1
  if (anchor.pageIdx === null || anchor.pageIdx === undefined) return null;
  const raw = Number(anchor.pageIdx);
  if (!Number.isFinite(raw)) return null;
  const page = Math.floor(raw) + 1;
  return page >= 1 ? page : null;
}

const JUMP_DELAYS_MS = [0, 80, 200, 400, 800];

/**
 * When enabled and numPages is ready, jump once by the URL anchor (once per session).
 */
export function useUrlAnchorJump(options: {
  /** boot done, scrollable */
  enabled: boolean;
  numPages: number;
  goToPage: (page: number) => void;
}) {
  const { enabled, numPages, goToPage } = options;
  const appliedKeyRef = useRef("");
  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;

  useEffect(() => {
    if (!enabled || !Number.isFinite(numPages) || numPages < 1) {
      return;
    }

    const anchor = resolveReaderAnchor() as UrlReaderAnchor | null;
    const page = pageNumberFromUrlAnchor(anchor);
    // Invalid page number: treat as handled, avoid re-reading URL repeatedly
    const key = page == null
      ? `none:${anchor?.blockId || ""}`
      : `p:${page}`;
    if (appliedKeyRef.current === key) {
      return;
    }
    if (page == null) {
      appliedKeyRef.current = key;
      return;
    }

    appliedKeyRef.current = key;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const delay of JUMP_DELAYS_MS) {
      timers.push(
        setTimeout(() => {
          goToPageRef.current(page);
        }, delay),
      );
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [enabled, numPages]);
}




