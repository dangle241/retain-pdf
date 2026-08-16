// Panel PDF đơn: React chỉ render khung container (trạng thái rỗng/lớp bọc/viewer host).
// DOM nội dung của .pdfViewer hoàn toàn do pdfjs quản lý theo kiểu mệnh lệnh (pdf-controller/pdf-renderer tìm điểm mount theo ID),
// đóng/mở hidden do showReaderPaneReady/Empty trong view.js chuyển; tuyệt đối không đưa trang PDF vào DOM ảo.
// Component này không thay đổi props, không có state; sau commit đầu, React không chạm lại các nút này.
//
// Toàn bộ ID container được viết dạng literal (không nối `${viewerKey}-wrap`):
// tests/page-dom-references.test.mjs dùng literal id="..." để kiểm tra quyền sở hữu,
// nối chuỗi sẽ khiến tham chiếu phía src/js/reader (view.js/viewer-mount-flow.js) bị báo nhầm là mồ côi.

import type { CSSProperties } from "react";
import { Panel } from "react-resizable-panels";

type ReaderPdfPane = "source" | "translated";

function paneStyle(pane: ReaderPdfPane): CSSProperties {
  return {
    maxHeight: "none",
    overflowY: "visible",
    overflowX: "clip",
    // Đường chia cột mảnh của panel bản dịch trong bố cục cũ (tái tạo tương đương quy tắc .reader-panel + .reader-panel).
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
