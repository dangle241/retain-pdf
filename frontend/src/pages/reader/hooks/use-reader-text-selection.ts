// 在 PDF 文本层上监听选区，给出浮条位置与创建批注所需字段。

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ReaderNotePane } from "../annotations/types.js";

export type ReaderTextSelection = {
  quote: string;
  page: number;
  pane: ReaderNotePane;
  /** 视口坐标，用于浮条定位 */
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

      // 找最近的页节点
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
      // 等浏览器完成选区
      window.setTimeout(readSelection, 0);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };
    const onScroll = () => {
      // 滚动后选区屏幕坐标失效，清浮条（保留浏览器选区）
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
