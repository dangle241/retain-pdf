// 单栏 PDF: 栏不滚动；纵向由total享 scroll shell 负责(对齐旧 reader-scroll-shell).
// Side-by-side等高由父级 usePageRowSync Done, 不做 display:contents.

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document } from "react-pdf";
import {
  useProtectedPdfFile,
  type ProtectedPdfFile,
} from "./useProtectedPdfFile.js";
import { setupReactPdf } from "./setup-react-pdf.js";
import { pageWidthFromShell } from "./reader-zoom.js";
import { PdfPageSlot } from "./PdfPageSlot.js";
import type { PageRowHeights } from "./usePageRowSync.js";
import type { ReaderPaneId } from "./reader-dom-contract.js";

/**
 * pages宽按"shell 全宽 × zoom%"计算, 与Current栏宽None关.
 * pageWidthOverride 在此语义下应传 shell 全宽(不yes半宽).
 */

setupReactPdf();

function readerDevicePixelRatio(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(1, Math.min(dpr, 2));
}

export type PdfDocumentPaneProps = {
  pane: ReaderPaneId;
  url?: string;
  preloadedFile?: ProtectedPdfFile | null;
  userZoom?: number;
  visible?: boolean;
  emptyLabel?: string;
  scrollRoot?: HTMLElement | null;
  /**
   * 阅读区全宽(shell clientWidth).
   * pages绘制宽 = pageWidthFromShell(此值, userZoom), 不随单栏/半栏变化.
   */
  pageWidthOverride?: number | null;
  /** Side-by-side行高sync */
  rowHeights?: PageRowHeights;
  onMetrics?: () => void;
  onLoadSuccess?: (info: { numPages: number; pane: ReaderPaneId }) => void;
  onLoadError?: (error: Error, pane: ReaderPaneId) => void;
  onNumPagesChange?: (numPages: number, pane: ReaderPaneId) => void;
};

const PdfDocumentPaneInner = forwardRef<HTMLElement, PdfDocumentPaneProps>(
  function PdfDocumentPaneInner(
    {
      pane,
      url = "",
      preloadedFile = null,
      userZoom = 1,
      visible = true,
      emptyLabel = "No  PDF",
      scrollRoot = null,
      pageWidthOverride = null,
      rowHeights,
      onMetrics,
      onLoadSuccess,
      onLoadError,
      onNumPagesChange,
    },
    ref,
  ) {
    const { file, loading, error: fetchError } = useProtectedPdfFile(url, preloadedFile);
    const [numPages, setNumPages] = useState(0);
    const [docError, setDocError] = useState("");
    const [paneEl, setPaneEl] = useState<HTMLElement | null>(null);
    const [paneWidth, setPaneWidth] = useState(480);
    const widthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastWidthRef = useRef(0);
    const dpr = useMemo(() => readerDevicePixelRatio(), []);

    useImperativeHandle(ref, () => paneEl as HTMLElement, [paneEl]);

    // pages宽只跟 shell 全宽 + zoom 走, 禁止用books栏 clientWidth(Side-by-side会变成 25%)
    useEffect(() => {
      const w = pageWidthOverride && pageWidthOverride >= 80
        ? pageWidthOverride
        : (scrollRoot?.clientWidth || 0);
      if (!Number.isFinite(w) || w < 80) return;
      if (Math.abs(w - lastWidthRef.current) < 8) return;
      lastWidthRef.current = w;
      setPaneWidth(w);
    }, [pageWidthOverride, scrollRoot, visible]);

    // shell 尺寸变化时sync
    useEffect(() => {
      if (!scrollRoot || typeof ResizeObserver === "undefined") return;
      if (pageWidthOverride && pageWidthOverride >= 80) return;
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width ?? scrollRoot.clientWidth;
        if (!Number.isFinite(w) || w < 80) return;
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
        widthTimerRef.current = setTimeout(() => {
          if (Math.abs(w - lastWidthRef.current) < 8) return;
          lastWidthRef.current = w;
          setPaneWidth(w);
        }, 80);
      });
      ro.observe(scrollRoot);
      return () => {
        ro.disconnect();
        if (widthTimerRef.current) clearTimeout(widthTimerRef.current);
      };
    }, [scrollRoot, pageWidthOverride]);

    const pageWidth = useMemo(
      () => pageWidthFromShell(paneWidth, userZoom),
      [paneWidth, userZoom],
    );

    const handleLoadSuccess = useCallback(
      ({ numPages: pages }: { numPages: number }) => {
        setNumPages(pages);
        setDocError("");
        onNumPagesChange?.(pages, pane);
        onLoadSuccess?.({ numPages: pages, pane });
      },
      [onLoadSuccess, onNumPagesChange, pane],
    );

    const handleLoadError = useCallback(
      (err: Error) => {
        const message = err?.message || "PDF parseFailed";
        setDocError(message);
        setNumPages(0);
        onNumPagesChange?.(0, pane);
        onLoadError?.(err, pane);
      },
      [onLoadError, onNumPagesChange, pane],
    );

    const pageNumbers = useMemo(
      () => (numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : []),
      [numPages],
    );

    const showEmpty = !url || Boolean(fetchError) || Boolean(docError);
    const emptyText = !url
      ? emptyLabel
      : fetchError || docError || emptyLabel;

    return (
      <section
        ref={setPaneEl}
        className={`reader-panel reader-react-pdf-pane${visible ? "" : " is-hidden"}`}
        data-reader-pane={pane}
        data-reader-engine="react-pdf"
        data-reader-visible={visible ? "true" : "false"}
        aria-hidden={visible ? undefined : true}
        aria-label={pane === "source" ? "Source PDF" : "Translation PDF"}
      >
        {showEmpty && !loading ? (
          <div className="reader-empty reader-react-pdf-empty" data-reader-pdf-empty={pane}>
            {emptyText}
          </div>
        ) : null}
        {loading ? (
          <div className="reader-empty reader-react-pdf-loading" data-reader-pdf-loading={pane}>
            正在加载 PDF...
          </div>
        ) : null}
        {file && !fetchError ? (
          <div className="reader-viewer-wrap reader-react-pdf-wrap">
            <Document
              file={file}
              loading={null}
              error={null}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              className="reader-react-pdf-document"
            >
              {pageNumbers.map((pageNumber) => (
                <PdfPageSlot
                  key={`${pane}-${pageNumber}`}
                  pane={pane}
                  pageNumber={pageNumber}
                  width={pageWidth}
                  devicePixelRatio={dpr}
                  scrollRoot={scrollRoot}
                  syncedMinHeight={rowHeights?.get(pageNumber) || 0}
                  onMetrics={onMetrics}
                />
              ))}
            </Document>
          </div>
        ) : null}
      </section>
    );
  },
);

export const PdfDocumentPane = memo(PdfDocumentPaneInner);




