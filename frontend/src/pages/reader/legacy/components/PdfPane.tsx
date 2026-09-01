// 单个 PDF 面板:React 只渲染容器骨架(空态/包裹层/viewer host)。
// .pdfViewer 的内容 DOM 完全由 pdfjs 命令式管理(pdf-controller/pdf-renderer 按 id 查找挂载),
// hidden 开合由 view.js 的 showReaderPaneReady/Empty 切换——绝不虚拟 DOM 化 PDF 页。
// 本组件无 props 变化、无 state,首次 commit 后 React 不会再触碰这些节点。
//
// 容器 id 全部写成字面量(不做 `${viewerKey}-wrap` 拼接):
// tests/page-dom-references.test.mjs 以 id="..." 字面量做归属校验,
// 拼接会让 src/js/reader 侧的引用(view.js/viewer-mount-flow.js)变孤儿误报。

import type { CSSProperties } from "react";
import { Panel } from "react-resizable-panels";

type ReaderPdfPane = "source" | "translated";

function paneStyle(pane: ReaderPdfPane): CSSProperties {
  return {
    maxHeight: "none",
    overflowY: "visible",
    overflowX: "clip",
    // 旧布局里译文面板的分栏细线(.reader-panel + .reader-panel 规则的等价复刻)
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
