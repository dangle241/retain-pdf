// Single PDF pane: React only renders container skeleton (empty state/wrapper/viewer host).
// .pdfViewer content DOM entirely managed by pdfjs imperatively (pdf-controller/pdf-renderer
// find and mount by id), hidden open/close toggled by view.js showReaderPaneReady/Empty —
// never virtualize PDF pages. No props changes, no state, React does not touch these
// nodes after first commit.
//
// Container ids all written as literals (not `${viewerKey}-wrap` concatenation):
// tests/page-dom-references.test.mjs uses id="..." literals for ownership verification,
// concatenation would orphan src/js/reader side references (view.js/viewer-mount-flow.js).

import type { CSSProperties } from "react";
import { Panel } from "react-resizable-panels";

type ReaderPdfPane = "source" | "translated";

function paneStyle(pane: ReaderPdfPane): CSSProperties {
  return {
    maxHeight: "none",
    overflowY: "visible",
    overflowX: "clip",
    // Translation panel's thin column line in old layout (equivalent recreation of
    // .reader-panel + .reader-panel rules)
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


