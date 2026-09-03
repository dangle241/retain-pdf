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
    // loadPdfDocument has no catch for pdfjsLib.getDocument(...).promise —
    // 404/CORS/corrupted PDFs reject here; previously thrown directly, swallowed by
    // mountReaderPdfPair's Promise.allSettled leaving no console trace,
    // user only sees "PDF not displaying" with no way to distinguish the cause. Added logging here,
    // does not change external behavior (still falls through to empty status display).
    console.error(`[reader] ${label || key} failed to load`, error);
    showReaderPaneEmpty(key, emptyId);
    return null;
  }
  if (!pdfDocument) {
    // loadPdfDocument silently returns null when no ready URL (no URL to parse,
    // or itemOrUrl is empty string) — also added a log to distinguish "no URL"
    // from "has URL but failed to load" caught above.
    console.warn(`[reader] ${label || key} has no ready resource URL; skipping mount`, { itemOrUrl });
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




