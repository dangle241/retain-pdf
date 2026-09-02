// Listen for selection on the PDF text layer and emit the floating-entry position and the fields needed to create annotations.

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ReaderNotePane } from "../annotations/types.js";

export type ReaderTextSelection = {
  quote: string;
  page: number;
  pane: ReaderNotePane;
  /** Viewport coordinates, used to locate the floating entry */
  rect: { left: number; top: number; width: number; height: number };
};

export function useReaderTextSelection(
  rootRef: RefObject<HTMLElement | null>,
  enabled = true,
): {
  selection: ReaderTextSelection | null;
  clearSelection: () => void;
} {
  const [selection, setSelection] = useState<ReaderTextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    const sel = globalThis.getSelection?.();
    sel?.removeAllRanges?.();
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const readSelection = () => {
      const root = rootRef.current;
      const sel = globalThis.getSelection?.();
      if (!root || !sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const quote = `${sel.toString() || ""}`.replace(/\s+/g, " ").trim();
      if (quote.length < 2) {
        setSelection(null);
        return;
      }

      // Find the nearest page node
      let node: Node | null = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
      }
      const pageEl = (node as HTMLElement | null)?.closest?.(
        "[data-reader-page]",
      ) as HTMLElement | null;
      if (!pageEl || !root.contains(pageEl)) {
        setSelection(null);
        return;
      }
      const page = Math.max(1, Math.floor(Number(pageEl.getAttribute("data-reader-page")) || 1));
      const paneAttr = pageEl.getAttribute("data-reader-pane");
      const pane: ReaderNotePane = paneAttr === "translated" ? "translated" : "source";

      const rects = range.getClientRects();
      const last = rects[rects.length - 1] || range.getBoundingClientRect();
      if (!last || (last.width === 0 && last.height === 0)) {
        setSelection(null);
        return;
      }

      setSelection({
        quote,
        page,
        pane,
        rect: {
          left: last.left,
          top: last.top,
          width: last.width,
          height: last.height,
        },
      });
    };

    const onMouseUp = () => {
      // Wait for browser to finish selection
      window.setTimeout(readSelection, 0);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };
    const onScroll = () => {
      // After scroll, selection screen coordinates are stale; clear floating entry (keep browser selection)
      setSelection((prev) => (prev ? null : prev));
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    rootRef.current?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
      rootRef.current?.removeEventListener("scroll", onScroll);
    };
  }, [enabled, rootRef, clearSelection]);

  return { selection, clearSelection };
}




