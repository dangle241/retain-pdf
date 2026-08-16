import { $ } from "../dom/query.js";
import {
  loadPdfDocument,
  resolveReaderArtifactUrl,
} from "./pdf-document.js";
import {
  bindReaderRegionHover,
  scheduleRegionOverlayRender,
} from "./region-interactions.js";
import { bindPrimaryViewer } from "./primary-viewer.js";
import {
  mountManualPages,
  scheduleVisibleManualPages,
} from "./pdf-renderer.js";
import {
  applyViewerScale,
  schedulePageRowSync as scheduleReaderPageRowSync,
  scheduleScaleRefresh as scheduleReaderScaleRefresh,
} from "./pdf-layout.js";
import {
  showReaderPaneEmpty,
  showReaderPaneReady,
} from "./view.js";

const viewerControllers = new Map();

export { resolveReaderArtifactUrl };

function getViewerController(key) {
  return viewerControllers.get(key) || null;
}

function renderCallbacks() {
  return {
    onPageRendered: () => {
      schedulePageRowSync();
      scheduleRegionOverlayRender();
    },
    onScaleChanged: () => schedulePageRowSync(),
    onScaleRefresh: () => schedulePageRowSync(),
  };
}

function schedulePageRowSync() {
  scheduleReaderPageRowSync(viewerControllers);
}

export function scheduleScaleRefresh() {
  scheduleReaderScaleRefresh(viewerControllers, renderCallbacks());
}

export { bindPrimaryViewer };

function createViewerController(key) {
  const scrollShell = $("reader-scroll-shell");
  const viewerHost = $(`${key}-viewer-host`);
  const viewerElement = $(`${key}-viewer`);
  if (!scrollShell || !viewerHost || !viewerElement) {
    return null;
  }

  const controller = {
    key,
    scrollShell,
    viewerHost,
    viewerElement,
    basePageWidth: 0,
    currentScale: 0,
    pdfDocument: null,
    pageViewports: new Map(),
    renderedPages: new Set(),
    renderTasks: new Map(),
    visiblePages: new Set(),
    pageObserver: null,
    primaryScrollHandler: null,
  };
  viewerControllers.set(key, controller);
  return controller;
}

export async function mountPdfViewer({
  key,
  itemOrUrl,
  label,
  emptyId,
  fetchProtected = null,
}) {
  const viewerWrap = $(`${key}-wrap`);
  const empty = $(emptyId);
  const controller = getViewerController(key) || createViewerController(key);
  if (!viewerWrap || !empty || !controller) {
    return null;
  }

  let pdfDocument = null;
  try {
    pdfDocument = await loadPdfDocument({ itemOrUrl, fetchProtected });
  } catch (error) {
    // Bên trong loadPdfDocument không có dự phòng cho pdfjsLib.getDocument(...).promise;
    // PDF 404/CORS/hỏng sẽ reject ở đây, trước kia bị ném thẳng lên và cuối cùng
    // bị Promise.allSettled của mountReaderPdfPair nuốt mà không để dấu vết trên console;
    // người dùng chỉ thấy "PDF này không hiển thị" mà không biết nguyên nhân. Thêm log tại đây
    // mà không đổi hành vi bên ngoài; vẫn lùi về trạng thái trống bên dưới.
    console.error(`[reader] không thể tải ${label || key}`, error);
    showReaderPaneEmpty(key, emptyId);
    return null;
  }
  if (!pdfDocument) {
    // loadPdfDocument âm thầm trả null khi "không có URL khả dụng" (không có URL để phân tích,
    // hoặc itemOrUrl là chuỗi rỗng); thêm log để phân biệt "không có URL"
    // với "có URL nhưng tải thất bại" được catch bên trên.
    console.warn(`[reader] ${label || key} không có địa chỉ tài nguyên khả dụng, bỏ qua việc gắn`, { itemOrUrl });
    showReaderPaneEmpty(key, emptyId);
    return null;
  }

  const firstPage = await pdfDocument.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  controller.basePageWidth = firstViewport.width;
  mountManualPages(controller, pdfDocument, firstViewport, renderCallbacks());
  applyViewerScale(controller, renderCallbacks());
  controller.visiblePages.add(1);
  if (pdfDocument.numPages > 1) {
    controller.visiblePages.add(2);
  }
  scheduleVisibleManualPages(controller, renderCallbacks());

  showReaderPaneReady(key, emptyId);

  return {
    key,
    pagesCount: pdfDocument.numPages,
    controller,
  };
}

export function bindResizeRefresh() {
  window.addEventListener("resize", scheduleScaleRefresh);
}

export { bindReaderRegionHover };
