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
    // loadPdfDocument Internal pair pdfjsLib.getDocument(...).promise No fallback——
    // 404/CORS/Corrupted PDF Will be here reject,Re-throw directly.,Eventually
// mountReaderPdfPair Promise.allSettled swallows errors; console leaves no trace.
    // User sees only"this part PDF Hide"Cannot determine cause. Add logs here.,
    // Preserve external behavior(Still falls to empty state below.)。
    console.error(`[reader] ${label || key} Failed to load`, error);
    showReaderPaneEmpty(key, emptyId);
    return null;
  }
  if (!pdfDocument) {
// loadPdfDocument returns null silently on timeout when "No available URL" (no parsable URL,
// or itemOrUrl initially empty string)ââAdd corresponding log entry to distinguish "No URL" easily.
// Same as above catch block: "URL exists but load failed." Two different causes.
    console.warn(`[reader] ${label || key} No available resource address,Jump to page number, current page`, { itemOrUrl });
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
