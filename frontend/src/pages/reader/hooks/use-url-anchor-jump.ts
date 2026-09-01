// URL anchor â react-pdf Page jump.
//
// Favorite / Search / Quote backjump occurs in URL Previous band ?page_idx=&block_id= (page_idx 0-based).
// Legacy engine schedules anchor jump in boot; default react-pdf path previously only
// void resolveReaderAnchor() meaning no jump occurred. This hook runs after PDF is ready and total pages are known
// Jump to page_idx+1Page slot layout wait retry with short delay
//
// block_id：react-pdf Not yet region Layer, page-level navigation only.

import { useEffect, useRef } from "react";
import { resolveReaderAnchor } from "../external.js";

export type UrlReaderAnchor = {
  pageIdx: number | null;
  blockId: string;
};

/** page_idx (0-based) → Reader page number. (1-based)Invalid return null */
export function pageNumberFromUrlAnchor(
  anchor: UrlReaderAnchor | null | undefined,
): number | null {
  if (!anchor) return null;
// Avoid Number(null)===0, otherwise "block_id only" is mistaken for page 1
  if (anchor.pageIdx === null || anchor.pageIdx === undefined) return null;
  const raw = Number(anchor.pageIdx);
  if (!Number.isFinite(raw)) return null;
  const page = Math.floor(raw) + 1;
  return page >= 1 ? page : null;
}

const JUMP_DELAYS_MS = [0, 80, 200, 400, 800];

/**
* When enabled and numPages is available. URL Anchor jump once (once per session).
 */
export function useUrlAnchorJump(options: {
  /** boot Complete, scrollable */
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
    // Invalid page: treat processed, avoid reread. URL
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
