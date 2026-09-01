// Reader startup orchestration (Phase 2b full): Full port of old src/js/reader/index.js.
// Run after React first commit (imperative module finds container by id, DOM must be in position first).
//
// Imperative reuse (non-React): pdf Family, interaction-flow, region-*,
// selection-favorites、favorites/*、markdown-preview、progress-presenter、
// chrome/mode Controllercolumn-resizer/panel-collapse(Maintain outer three-column layout. CSS Variable scheme,
// rrp Only count inner layer doubles. PDF Group——Old three-column layout not sibling flex,Drawer is fixed overlay +
// body :has() cascade, rrp rewrite entire outer layer. reader-page.css, pixel risk outweighs benefit.)
//
// React side (via runtime state injection): download menu context, Annotation Panel Port, AI chat Port.
//
// Temporal contract (pixel-level): chrome.bindEvents() must precede drawerStore.open("ai")â
// Fade-out timer in "No drawer open" time slot, body exits reader-chrome-muted after 1.6s,
// Matches old page state at baseline screenshot time.

import { useEffect, useState } from "react";
import {
  bindResizeRefresh,
  scheduleScaleRefresh,
} from "../../../../js/reader/pdf-controller.js";
import {
  setReaderBootLoading,
  setReaderModeHud,
  showBothReaderEmpty,
  showReaderPaneEmpty,
} from "../../../../js/reader/view.js";
import {
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
} from "../../../../js/reader/config-port.js";
import { defaultReaderDataPort } from "../../../../js/reader/data-port.js";
import { resolveResourceUrl } from "../../../../js/job/artifacts.js";
import { isMockMode } from "../../../../js/config/runtime.js";
import { MOCK_DOCUMENT_SOURCE_PDF_URL } from "../../../../js/mock/documents.js";
import {
  READER_PROGRESS_COPY,
  createReaderPageState,
  resetReaderProgressState,
} from "../../../../js/reader/page-state.js";
import {
  defaultReaderProgressPresenter,
} from "../../../../js/reader/progress-presenter.js";
import { bindReaderInteractions } from "../../../../js/reader/interaction-flow.js";
import {
  jumpToReaderAnchor,
  resolveSelectionQuote,
} from "../../../../js/reader/region-interactions.js";
import { createReaderAiContext } from "../../../../js/reader/ai-context.js";
import { createReaderAskAnswerer } from "../../../../js/reader/ai/ask-answerer.js";
import { createReaderChromeController } from "../../../../js/reader/chrome-controller.js";
import { createReaderColumnResizer } from "../../../../js/reader/column-resizer.js";
import { createReaderMarkdownPreview } from "../../../../js/reader/markdown-preview.js";
import { createReaderModeController } from "../../../../js/reader/mode-controller.js";
import { createReaderPanelCollapse } from "../../../../js/reader/panel-collapse.js";
import { createReaderSelectionFavorites } from "../../../../js/reader/selection-favorites.js";
import { createReaderServerFavoritesPort } from "../../../../js/reader/server-favorites-port.js";
import {
  resolveReaderJobId,
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "../../../../js/reader/resource-resolver.js";
import { mountReaderPdfPair } from "../../../../js/reader/viewer-mount-flow.js";
import type { ReaderMetadata, RegionsPayload } from "../../../../js/reader/types.js";

let bootStarted = false;

// Clicking reference jumps to original anchor.(Use same positioning logic as favorites navigation.),Keep drawer open.;
// When referencing other documents,Navigate to that document's reader with anchor parameter
function jumpToCitationFactory(jobId) {
  return (citation) => {
    const citationJobId = `${citation?.job_id || ""}`.trim();
    if (citationJobId && citationJobId !== jobId) {
      const params = new URLSearchParams({ job_id: citationJobId });
      if (Number.isFinite(Number(citation?.page_idx))) {
        params.set("page_idx", `${citation.page_idx}`);
      }
      if (citation?.block_id) {
        params.set("block_id", `${citation.block_id}`);
      }
      window.location.href = `reader.html?${params.toString()}`;
      return true;
    }
    return jumpToReaderAnchor({
      pageIdx: citation?.page_idx,
      blockId: citation?.block_id,
    });
  };
}

// URL With anchor(?page_idx=&block_id=)Skip to page./regions Async mount,And startup layout
// Reset scroll position to top after mount.——jump One success doesn't count,Must press"Is target page
// "Truly in viewport" determination, back off and retry if not ready (converge after layout stabilizes).
function scheduleAnchorJump(anchor) {
  const anchorPageNumber = Number.isFinite(Number(anchor.pageIdx))
    ? Number(anchor.pageIdx) + 1
    : 0;
  const anchorSettled = () => {
    if (!anchorPageNumber) {
      return true;
    }
    const pageElement = document.querySelector(
      `#reader-pdf-viewer .page[data-page-number="${anchorPageNumber}"]`,
    );
    if (!pageElement) {
      return false;
    }
    const rect = pageElement.getBoundingClientRect();
    return rect.top < globalThis.innerHeight && rect.bottom > 0;
  };
// PDF rendering and layout may take over 20 seconds; periodic scrollIntoView will be
  // Layout reset consumes;Retry until ready.,Yield immediately on manual scroll.
  let anchorCanceled = false;
  const cancelAnchor = () => {
    anchorCanceled = true;
  };
  for (const eventName of ["wheel", "touchmove", "keydown"]) {
    globalThis.addEventListener?.(eventName, cancelAnchor, { once: true, passive: true });
  }
  const tryJump = (attempt = 0) => {
    if (anchorCanceled) {
      return;
    }
    jumpToReaderAnchor(anchor);
    if (attempt >= 40) {
      return;
    }
    globalThis.setTimeout(() => {
      if (!anchorCanceled && !anchorSettled()) {
        tryJump(attempt + 1);
      }
    }, 600);
  };
// Do not use requestAnimationFrame: rAF is suspended in background tabs, callbacks
  // Never trigger,Anchor positioning fails silently.(Hit in testing)。
  globalThis.setTimeout(tryJump, 0);
}

// Populate source column with explicit text when source file unavailable (orphaned documentation: document exists but source not persisted. PDF).
// #reader-pdf-empty default is a dashed placeholder block without text; write textContent directly to make it say something.
function showReaderSourceUnavailable() {
  showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
  const empty = document.getElementById("reader-pdf-empty");
  if (empty) {
empty.textContent = "Source file unavailable: This document has no readable source PDF (possibly only a record, not an archived file).";
  }
}

// Collection document "Read Source" (F4): no job, only attach source document column, switch to source single-column mode, skip all
// consume jobId secondary features (favorites/AI/annotations/markdown/interaction). Source document URL uses
// /documents/:id/source.pdf (mock pattern goes to mock:// channel).
async function mountSourceOnlyReader({
  documentId,
  pageState,
  modeController,
  applyBootProgress,
  syncBootProgress,
}) {
// Read-only source doc single-column throughout. â **First** collapse to source single column; source load success or failure should not
  // Revert to default two-column comparison empty state.(Otherwise missing source yields two blank columns = Blank)。
  modeController.setMode("source");
  try {
    applyBootProgress(14, READER_PROGRESS_COPY.metadata, "metadata");
    pageState.progress.metadataReady = true;
    syncBootProgress();

    const sourcePdf = isMockMode()
      ? MOCK_DOCUMENT_SOURCE_PDF_URL
      : resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(documentId)}/source.pdf`);

    const { sourceReady } = await mountReaderPdfPair({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      sourcePdf,
      translatedPdfUrl: "",
      onSourceSettled: () => {
        pageState.progress.sourceDone = true;
        syncBootProgress();
      },
      onTranslatedSettled: () => {
        pageState.progress.translatedDone = true;
        syncBootProgress();
      },
    });

    if (!sourceReady) {
// Source file inaccessible (like orphaned document lines: document record exists but source PDF not imported, /documents/:id/source.pdf 404) â add clear copy to single column, no whitespace.
      // /documents/:id/source.pdf 404)——Add clear copy to single column.,No whitespace.
      showReaderSourceUnavailable();
      applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
      setReaderBootLoading(false);
      return;
    }

    applyBootProgress(100, READER_PROGRESS_COPY.ready, "ready");
    setReaderBootLoading(false);

    const anchor = resolveReaderAnchor();
    if (anchor) {
      scheduleAnchorJump(anchor);
    }
  } catch (_err) {
    showReaderSourceUnavailable();
    applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
    setReaderBootLoading(false);
  }
}

async function initializeReader({ drawerStore, publish }) {
// Set route first (pure URL parsing, no side effects): full comparative reading with job; only document_id
// is collection document "Read Source" (F4), skip all sub-features and toolbar that consume jobId.
  const jobId = resolveReaderJobId(defaultReaderPageConfigPort);
  const sourceOnlyDocumentId = jobId ? "" : resolveReaderDocumentId();
  const sourceOnly = Boolean(sourceOnlyDocumentId);
  if (sourceOnly) {
// CSS hide translation accordingly / compare tab and Markdown/favorites/annotations/AI/Download tools group (consume jobId).
    document.documentElement.classList.add("reader-source-only");
  }

  const pageState = createReaderPageState();
  let readerInteractionController = null;
  let readerMarkdownPreview = null;

  const applyBootProgress = (percent, text, stage = "progress") => {
    defaultReaderProgressPresenter.apply({
      bootProgressBarState: pageState.bootProgressBar,
      percent,
      stage,
      text,
    });
  };
  const syncBootProgress = () => {
    defaultReaderProgressPresenter.sync(pageState);
  };

  const chromeController = createReaderChromeController();
  const modeController = createReaderModeController({
    onModeChanged: () => {
      readerInteractionController?.syncIndicatorForMode?.();
      chromeController.wake();
      scheduleScaleRefresh();
    },
    onModeHudChanged: setReaderModeHud,
  });
  // Collapse controller:Manage left/right sidebar collapse;Toolbar click → auto-expand right panel.
  const panelCollapse = createReaderPanelCollapse({
    onChange: () => scheduleScaleRefresh(),
  });
  // Programmatic startup open("ai") Do not clear user-persisted right panel collapse.;Auto-expand only on top-bar tool click.
  let allowAutoExpandRight = false;
  drawerStore.subscribe((active) => {
    scheduleScaleRefresh();
    if (active && allowAutoExpandRight) {
      panelCollapse.expandRight();
    }
    if (active === "markdown") {
      void readerMarkdownPreview?.ensureLoaded();
    }
  });

  bindResizeRefresh();
  chromeController.bindEvents();
  modeController.bindEvents();
// Three-column skeleton: left/right panels resizable via drag (persistent), refresh on drag. PDF zoom
  createReaderColumnResizer({ onResize: () => scheduleScaleRefresh() }).bindEvents();
  // Left/right column collapse handle(Apply persistent collapse state first)
  panelCollapse.bindEvents();
// Default expand right panel (AI Q&A). Must be later than chromeController.bindEvents(), see timing contract in file header;
  // If user last collapsed right column, then CSS Keep collapsed.
// Source doc lacks read-only state. job â AI/annotations/Markdown all unavailable, do not expand right sidebar (otherwise it hangs
// forever as "Preparing..." empty panel).
  if (!sourceOnly) {
    drawerStore.open("ai");
  }
// After startup open is complete, auto-expand right sidebar only after user clicks top toolbar.
  allowAutoExpandRight = true;

  setReaderBootLoading(true);
  resetReaderProgressState(pageState);
  syncBootProgress();

  if (sourceOnly) {
    await mountSourceOnlyReader({
      documentId: sourceOnlyDocumentId,
      pageState,
      modeController,
      applyBootProgress,
      syncBootProgress,
    });
    return;
  }
  if (!jobId) {
    showBothReaderEmpty();
    applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
    setReaderBootLoading(false);
    return;
  }

  try {
    applyBootProgress(14, READER_PROGRESS_COPY.metadata, "metadata");
    const {
      jobPayload,
      manifestPayload,
      readerMetadata,
      regionsPayload,
    } = await defaultReaderDataPort.loadReaderPayload(jobId);
    pageState.progress.metadataReady = true;
    syncBootProgress();

    const sourcePdf = resolveReaderSourcePdf(manifestPayload);
    const translatedPdfUrl = resolveReaderTranslatedPdfUrl(jobPayload, manifestPayload);

    const { sourceReady, translatedReady } = await mountReaderPdfPair({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      sourcePdf,
      translatedPdfUrl,
      onSourceSettled: () => {
        pageState.progress.sourceDone = true;
        syncBootProgress();
      },
      onTranslatedSettled: () => {
        pageState.progress.translatedDone = true;
        syncBootProgress();
      },
    });

    if (!sourceReady) {
      showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
    }
    if (!translatedReady) {
      showReaderPaneEmpty("reader-translated-pdf", "reader-translation-empty");
    }
    if (!sourceReady && !translatedReady) {
      applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
      setReaderBootLoading(false);
      return;
    }

    readerInteractionController = bindReaderInteractions({
      apiPrefix: defaultReaderDataPort.apiPrefix,
      fetchTranslationItem: defaultReaderDataPort.fetchRegionTranslationItem,
      jobId,
      pageState,
      readerMetadata: readerMetadata as ReaderMetadata | null,
      regionsPayload: regionsPayload as RegionsPayload | null,
      sourceReady,
      translatedReady,
    });

// Double-click to select screenshot excerpt (imperative island, includes favorites Drawer list rendering)
    const serverFavoritesPort = createReaderServerFavoritesPort({ jobId });
    createReaderSelectionFavorites({
      drawerController: drawerStore,
      jobId,
      setReaderMode: modeController.setMode,
      resolveQuote: resolveSelectionQuote,
      serverFavoritesPort,
    }).bindEvents();

// Annotation panel port (open/close subscription bridged by drawer component to drawer store)
    const jobFields = (jobPayload || {}) as { source_filename?: string; title?: string };
    const documentTitle = `${jobFields.source_filename || jobFields.title || jobId}`;
    const clipboard = globalThis.navigator?.clipboard || null;
    const annotationPorts = {
      loadAnnotations: () => serverFavoritesPort.loadServerFavorites() || Promise.resolve([]),
      deleteAnnotation: (favoriteId) => serverFavoritesPort.removeServerFavorite(favoriteId) || Promise.resolve(false),
      saveNote: (annotation, note) => serverFavoritesPort.recreateFavoriteNote(annotation, note) || Promise.resolve(null),
      jumpToAnchor: (anchor) => jumpToReaderAnchor(anchor),
      exportMarkdown: async (text) => {
        try {
          await clipboard?.writeText?.(text);
          return true;
        } catch (error) {
          console.error("Failed to export annotations to clipboard.", error);
          return false;
        }
      },
      documentTitle: () => documentTitle,
    };

    readerMarkdownPreview = createReaderMarkdownPreview({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      jobId,
      loadMarkdownPayload: defaultReaderDataPort.loadMarkdownPayload,
    });

    const readerAiContext = createReaderAiContext({
      drawerController: drawerStore,
    });
    readerAiContext.bindEvents();

// React one-time side injection: download menu context, Annotation Port, AI chat port
    publish({
      annotations: annotationPorts,
      chat: {
        aiContext: readerAiContext,
        jobId,
        jumpToCitation: jumpToCitationFactory(jobId),
        loadMarkdownPayload: defaultReaderDataPort.loadMarkdownPayload,
        remoteAnswerer: createReaderAskAnswerer({
          jobId,
          resolveQuote: resolveSelectionQuote,
        }),
      },
      downloads: {
        fetchProtected: defaultReaderDataPort.fetchProtected,
        jobId,
        jobPayload,
        manifestPayload,
      },
    });

    applyBootProgress(100, READER_PROGRESS_COPY.ready, "ready");
    setReaderBootLoading(false);

    const anchor = resolveReaderAnchor();
    if (anchor) {
      scheduleAnchorJump(anchor);
    }
  } catch (_err) {
    showBothReaderEmpty();
    applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
    setReaderBootLoading(false);
  }
}

export function useReaderBoot(drawerStore) {
  const [runtime, setRuntime] = useState({
    annotations: null,
    chat: null,
    downloads: null,
  });
  useEffect(() => {
    if (bootStarted) {
      return;
    }
    bootStarted = true;
    void initializeReader({
      drawerStore,
      publish: (parts) => setRuntime((prev) => ({ ...prev, ...parts })),
    });
  }, [drawerStore]);
  return runtime;
}
