// Reader shell dimensions: merges shellRef + shellEl state + ResizeObserver.
// bindShell writes both ref (sync read) and state (drives re-render / mounts observer).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { comparePaneWidth } from "../pdf/reader-zoom.js";

export type ReaderShellApi = {
  shellRef: RefObject<HTMLDivElement | null>;
  /** same node as shellRef.current; state for children that need re-render when mounted */
  shellEl: HTMLElement | null;
  shellWidth: number;
  /** half width for compare columns, min 160 */
  compareColWidth: number;
  bindShell: (node: HTMLDivElement | null) => void;
};

const MIN_SHELL_WIDTH = 160;
const WIDTH_CHANGE_THRESHOLD = 8;
const DEFAULT_SHELL_WIDTH = 960;

export function useReaderShell(options?: {
  /** called when shellWidth changes (e.g. repinIfRestoring) */
  onWidthChange?: (width: number) => void;
}): ReaderShellApi {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);
  const [shellWidth, setShellWidth] = useState(DEFAULT_SHELL_WIDTH);

  // Stable callback identity so ResizeObserver effect only depends on shellEl
  const onWidthChangeRef = useRef(options?.onWidthChange);
  onWidthChangeRef.current = options?.onWidthChange;

  const bindShell = useCallback((node: HTMLDivElement | null) => {
    shellRef.current = node;
    setShellEl(node);
  }, []);

  useEffect(() => {
    const shell = shellEl;
    if (!shell || typeof ResizeObserver === "undefined") {
      return;
    }

    const apply = (w: number) => {
      if (!Number.isFinite(w) || w < MIN_SHELL_WIDTH) {
        return;
      }
      setShellWidth((prev) => {
        if (Math.abs(prev - w) < WIDTH_CHANGE_THRESHOLD) {
          return prev;
        }
        return w;
      });
    };

    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect?.width ?? shell.clientWidth);
    });
    ro.observe(shell);
    apply(shell.clientWidth);
    return () => ro.disconnect();
  }, [shellEl]);

  // Notify after shellWidth settles (e.g. re-pin anchor while restoring)
  useEffect(() => {
    onWidthChangeRef.current?.(shellWidth);
  }, [shellWidth]);

  // Side-by-side half-column width: divided by shell (minus center line), for 100% fit to left/right columns
  const compareColWidth = comparePaneWidth(shellWidth);

  return {
    shellRef,
    shellEl,
    shellWidth,
    compareColWidth,
    bindShell,
  };
}



