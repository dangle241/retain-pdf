// Mode switch / Reading anchor lock and recovery during page jumps.
// Critical rule: lock before switch progressRecovery period prohibits. scroll Write back anchor, and never re-measure。

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

  /** User true reading anchor (user scroll only) / jump / Update after restore completes */
  const anchorRef = useRef<PageScrollProgress>({ page: 1, fraction: 0 });
  /** Restore locked anchor (not intermediate scroll Event pollution) */
  const pendingRestoreRef = useRef<PageScrollProgress | null>(null);
  /** Restoring: forbidden scroll Write back. anchor */
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
    // Recovery complete: anchor pinned to locked value, then allow scroll updates.
    anchorRef.current = cloneProgress(locked);
    pendingRestoreRef.current = null;
    if (unfreezeTimerRef.current != null) {
      clearTimeout(unfreezeTimerRef.current);
    }
    // Unfreeze later. Avoid last programmatic run. scroll Event writes dirty anchor.
    unfreezeTimerRef.current = setTimeout(() => {
      unfreezeTimerRef.current = null;
      restoringRef.current = false;
    }, UNFREEZE_DELAY_MS);
  }, []);

  // Update anchors only on user scroll; ignore during recovery.
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

  // Post mode switch: use only pending Lock anchor recovery, never re-measure measure
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

    // Re-freeze to handle strict mode. effect rerun)
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
        // Fit page width/Pin after line-height sync; same locked Idempotent. Prevents drift.
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
// 1) Freeze first to prevent setMode post-layout clamping of scrollTop from triggering scroll write to dirty anchor
    restoringRef.current = true;
    // 2) Lock current position before layout changes.
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
