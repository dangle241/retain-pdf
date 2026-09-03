// Reading anchor lock and restore on mode switch / jump to page.
// Key rules: lock progress before switching, forbid scroll from writing back the anchor during restore, and never re-measure.

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  alignShellToPage,
  alignShellToProgress,
  applyPageScrollProgress,
  clampPageNumber,
  cloneProgress,
  measurePageScrollProgress,
  scrollShellToPage,
  type PageScrollProgress,
} from "./scroll-to-page.js";

export type ReadingAnchorPane = "source" | "translated";

const MODE_RESTORE_DELAYS_MS = [0, 48, 140, 320, 560];
const MODE_RESTORE_SAFETY_MS = 700;
const GOTO_ALIGN_DELAYS_MS = [80, 200, 400];
const GOTO_SAFETY_MS = 500;
const UNFREEZE_DELAY_MS = 50;

export function useReadingAnchor(
  shellRef: RefObject<HTMLElement | null>,
  options: {
    primaryPane: ReadingAnchorPane;
    /** when mode changes, hook restores locked progress */
    mode: string;
    /** false while boot loading */
    enabled?: boolean;
  },
): {
  /** measure shell progress (HUD / fallback); does not freeze restore */
  lockFromShell: () => PageScrollProgress;
  /** call before setMode; freezes restore and locks progress */
  beginModeSwitch: () => PageScrollProgress;
  /** jump to page top; freezes briefly */
  goToPage: (page: number, numPages: number) => void;
  getAnchor: () => PageScrollProgress;
  isRestoring: () => boolean;
  /** call when layout settles (rowHeights/shellWidth) while restoring — re-pin locked only */
  repinIfRestoring: () => void;
} {
  const { primaryPane, mode, enabled = true } = options;

  /** User's real reading anchor (only updated by user scroll / jump / restore complete) */
  const anchorRef = useRef<PageScrollProgress>({ page: 1, fraction: 0 });
  /** Anchor locked for this restore cycle (not polluted by intermediate scroll events) */
  const pendingRestoreRef = useRef<PageScrollProgress | null>(null);
  /** During restore: forbid scroll from writing back the anchor */
  const restoringRef = useRef(false);
  const prevModeRef = useRef(mode);
  const cancelRestoreRef = useRef<(() => void) | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unfreezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryPaneRef = useRef(primaryPane);
  primaryPaneRef.current = primaryPane;

  const clearRestoreTimers = useCallback(() => {
    cancelRestoreRef.current?.();
    cancelRestoreRef.current = null;
    if (safetyTimerRef.current != null) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const finishRestore = useCallback((locked: PageScrollProgress) => {
    // Restore complete: pin the anchor back to the locked value, then allow scroll updates
    anchorRef.current = cloneProgress(locked);
    pendingRestoreRef.current = null;
    if (unfreezeTimerRef.current != null) {
      clearTimeout(unfreezeTimerRef.current);
    }
    // Unfreeze after a short delay to avoid the last programmatic scroll event dirtying the anchor
    unfreezeTimerRef.current = setTimeout(() => {
      unfreezeTimerRef.current = null;
      restoringRef.current = false;
    }, UNFREEZE_DELAY_MS);
  }, []);

  // Only update the anchor on user scroll; ignore everything during restore
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let root: HTMLElement | null = null;
    let onScroll: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      if (cancelled) return;
      const el = shellRef.current;
      if (!el) {
        retryTimer = setTimeout(attach, 50);
        return;
      }
      root = el;
      onScroll = () => {
        if (restoringRef.current) {
          return;
        }
        const progress = measurePageScrollProgress(root, primaryPaneRef.current);
        if (progress) {
          anchorRef.current = progress;
        }
      };
      root.addEventListener("scroll", onScroll, { passive: true });
      if (!restoringRef.current) {
        onScroll();
      }
    };

    attach();
    return () => {
      cancelled = true;
      if (retryTimer != null) {
        clearTimeout(retryTimer);
      }
      if (root && onScroll) {
        root.removeEventListener("scroll", onScroll);
      }
    };
  }, [enabled, mode, primaryPane, shellRef]);

  // After mode switch: only restore by the pending locked anchor, never re-measure
  useEffect(() => {
    if (prevModeRef.current === mode) {
      return;
    }
    prevModeRef.current = mode;

    if (!enabled) {
      restoringRef.current = false;
      pendingRestoreRef.current = null;
      clearRestoreTimers();
      return;
    }

    const locked = pendingRestoreRef.current
      ? cloneProgress(pendingRestoreRef.current)
      : cloneProgress(anchorRef.current);

    // Ensure frozen again (handles effect rerun under StrictMode)
    restoringRef.current = true;
    pendingRestoreRef.current = locked;
    anchorRef.current = locked;

    clearRestoreTimers();
    cancelRestoreRef.current = alignShellToProgress(
      () => shellRef.current,
      locked,
      {
        behavior: "auto",
        pane: primaryPane,
        // Wait for page width / line-height sync before pinning; the same locked value is idempotent and won't keep scrolling
        delaysMs: MODE_RESTORE_DELAYS_MS,
        onDone: () => finishRestore(locked),
      },
    );

    // Fallback unfreeze
    safetyTimerRef.current = setTimeout(() => {
      safetyTimerRef.current = null;
      finishRestore(locked);
    }, MODE_RESTORE_SAFETY_MS);

    return () => {
      clearRestoreTimers();
    };
  }, [mode, enabled, primaryPane, shellRef, finishRestore, clearRestoreTimers]);

  useEffect(() => {
    return () => {
      clearRestoreTimers();
      if (unfreezeTimerRef.current != null) {
        clearTimeout(unfreezeTimerRef.current);
        unfreezeTimerRef.current = null;
      }
    };
  }, [clearRestoreTimers]);

  const lockFromShell = useCallback((): PageScrollProgress => {
    const measured = measurePageScrollProgress(
      shellRef.current,
      primaryPaneRef.current,
    );
    if (measured) {
      return cloneProgress(measured);
    }
    return cloneProgress(anchorRef.current);
  }, [shellRef]);

  const beginModeSwitch = useCallback((): PageScrollProgress => {
    // 1) Freeze first, to prevent scroll triggered by scrollTop clamp during layout changes after setMode from dirtying the anchor
    restoringRef.current = true;
    // 2) Lock the current position before the layout change
    const measured = measurePageScrollProgress(
      shellRef.current,
      primaryPaneRef.current,
    );
    const locked = cloneProgress(measured ?? anchorRef.current);
    anchorRef.current = locked;
    pendingRestoreRef.current = locked;
    return locked;
  }, [shellRef]);

  const goToPage = useCallback((page: number, numPages: number) => {
    const target = clampPageNumber(page, numPages || 1);
    const locked: PageScrollProgress = { page: target, fraction: 0 };
    anchorRef.current = locked;
    restoringRef.current = true;
    pendingRestoreRef.current = locked;

    clearRestoreTimers();
    const pane = primaryPaneRef.current;
    scrollShellToPage(shellRef.current, target, "smooth", pane);
    cancelRestoreRef.current = alignShellToPage(
      () => shellRef.current,
      target,
      {
        behavior: "auto",
        pane,
        delaysMs: GOTO_ALIGN_DELAYS_MS,
        onDone: () => finishRestore(locked),
      },
    );
    safetyTimerRef.current = setTimeout(() => {
      safetyTimerRef.current = null;
      finishRestore(locked);
    }, GOTO_SAFETY_MS);
  }, [shellRef, finishRestore, clearRestoreTimers]);

  const getAnchor = useCallback((): PageScrollProgress => {
    return cloneProgress(anchorRef.current);
  }, []);

  const isRestoring = useCallback((): boolean => {
    return restoringRef.current;
  }, []);

  const repinIfRestoring = useCallback(() => {
    if (!restoringRef.current || !pendingRestoreRef.current) {
      return;
    }
    const locked = cloneProgress(pendingRestoreRef.current);
    applyPageScrollProgress(
      shellRef.current,
      locked,
      "auto",
      primaryPaneRef.current,
    );
  }, [shellRef]);

  return {
    lockFromShell,
    beginModeSwitch,
    goToPage,
    getAnchor,
    isRestoring,
    repinIfRestoring,
  };
}




