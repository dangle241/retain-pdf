// Single PDF panel: React Render container skeleton only (empty state/Wrapper/viewer host).
// .pdfViewer content DOM managed entirely by pdfjs Imperative management (pdf-controller/pdf-renderer find mount by id),
// hidden Toggle by view.js showReaderPaneReady/Empty switchâNever mock DOM-ify PDF Page.
// Component has no props Change, no state, React Skip these nodes after first commit.
//
// Container id Convert all to literals (do not use `${viewerKey}-wrap` concatenation):
// tests/page-dom-references.test.mjs uses id="..." Literal ownership validation,
// Concatenation will src/js/reader Side reference(view.js/viewer-mount-flow.js)Orphan false positive.

import type { CSSProperties } from "react";
import { Panel } from "react-resizable-panels";

type ReaderPdfPane = "source" | "translated";

function paneStyle(pane: ReaderPdfPane): CSSProperties {
  return {
    maxHeight: "none",
    overflowY: "visible",
    overflowX: "clip",
    // Fine divider line for translation panel in legacy layout(.reader-panel + .reader-panel equivalent reproduction of rules)
    ...(pane === "translated"
      ? { borderLeft: "1px solid color-mix(in srgb, var(--shadow-color) 4%, transparent)" }
      : null),
  };
}

export function PdfPane({ pane }: { pane: ReaderPdfPane }) {
  if (pane === "source") {
    return (
      <Panel
        id="reader-pane-source"
        role="tabpanel"
        data-reader-pane="source"
        aria-labelledby="reader-tab-source"
        className="reader-panel"
        style={paneStyle("source")}
      >
        <div id="reader-pdf-empty" className="reader-empty hidden"></div>
        <div id="reader-pdf-wrap" className="reader-viewer-wrap hidden">
          <div id="reader-pdf-viewer-host" className="reader-viewer-host">
            <div id="reader-pdf-viewer" className="pdfViewer"></div>
          </div>
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      id="reader-pane-translated"
      role="tabpanel"
      data-reader-pane="translated"
      aria-labelledby="reader-tab-translated"
      className="reader-panel"
      style={paneStyle("translated")}
    >
      <div id="reader-translation-empty" className="reader-empty hidden"></div>
      <div id="reader-translated-pdf-wrap" className="reader-viewer-wrap hidden">
        <div id="reader-translated-pdf-viewer-host" className="reader-viewer-host">
          <div id="reader-translated-pdf-viewer" className="pdfViewer"></div>
        </div>
      </div>
    </Panel>
  );
}
