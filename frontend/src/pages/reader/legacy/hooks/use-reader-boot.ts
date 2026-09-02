// Reader boot orchestration (Phase 2b full port): a complete port of legacy src/js/reader/index.js.
// Runs after React's first commit (imperative modules look up containers by id; DOM must be in place first).
//
// Imperative reuse (not React-ified): pdf family, interaction-flow, region-*,
// selection-favorites, favorites/*, markdown-preview, progress-presenter,
// chrome/mode controllers, column-resizer/panel-collapse (the three-column outer
// layer keeps the CSS variable scheme; rrp only unifies the inner dual-PDF group —
// the legacy three-column is not sibling flex, the drawer is a fixed overlay +
// body :has() cascade; rewriting rrp's outer layer would require redoing the entire
// reader-page.css, with pixel risk far outweighing the benefit).
//
// React side (injected via runtime state): download menu context, annotations panel ports, AI chat ports.
//
// Timing contract (pixel-level): chrome.bindEvents() must run before drawerStore.open("ai") —
// the fade-out timer is scheduled when "no drawer is open yet", and 1.6s later the body
// enters reader-chrome-muted, matching the form the legacy page had at the baseline-screenshot moment.

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

// Citation click jumps to the source anchor (same location logic as favorites jump); drawer stays open;
// when the citation belongs to another document, navigate to that document's Reader with anchor params
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

// When the URL carries an anchor (?page_idx=&block_id=), jump to it. Pages/regions mount
// asynchronously, and the start-layout workflow resets scroll position to the top after mount —
// a single successful jump doesn't count; must decide by "is the target page really in the viewport";
// if not yet settled, retry with backoff (converges once layout stabilizes).
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
  // PDF rendering and layout can last over twenty seconds; during that time scrollIntoView
  // gets swallowed by the layout reset; keep retrying until settled; the moment the user
  // scrolls manually, yield immediately.
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
  // Do not use requestAnimationFrame: in background tabs rAF is suspended and the callback
  // never fires, so anchor location silently fails (this was hit in practice).
  globalThis.setTimeout(tryJump, 0);
}

// When the source file is not ready, fill the source column with explicit copy (orphan document:
// there is a document row but no uploaded source PDF).
// #reader-pdf-empty is a dashed placeholder with no text by default; just write textContent to give it something to say.
function showReaderSourceUnavailable() {
  showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
  const empty = document.getElementById("reader-pdf-empty");
  if (empty) {
    empty.textContent = "Source file not ready: this document has no readable source PDF (possibly only a record, no file uploaded).";
  }
}

// Library document "Read Source" (F4): no job; only mount the source-document column, switch to source single-column
// mode, and skip every side-tool that needs jobId (favorites/AI/annotations/markdown/interaction).
// Source-document URL goes through /documents/:id/source.pdf (mock mode uses the mock:// channel).
async function mountSourceOnlyReader({
  documentId,
  pageState,
  modeController,
  applyBootProgress,
  syncBootProgress,
}) {
  // The read-only source-document flow is single-column throughout — **first** collapse into source single-column;
  // whether the source loads successfully or fails, it must not fall back to the default two-column side-by-side empty
  // state (otherwise a missing source file would mean two blank columns = a blank page).
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
      // Source file unavailable (e.g. orphan document row: has document record but no uploaded source PDF,
      // /documents/:id/source.pdf 404) — give the single column an explicit message; no blank.
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
  // Decide the route first (pure URL parse, no side effects): with job, take the full side-by-side Reader;
// only document_id is the library document "Read Source" (F4), which must skip every side-tool/tool-bar
// that consumes jobId.
  const jobId = resolveReaderJobId(defaultReaderPageConfigPort);
  const sourceOnlyDocumentId = jobId ? "" : resolveReaderDocumentId();
  const sourceOnly = Boolean(sourceOnlyDocumentId);
  if (sourceOnly) {
    // CSS uses this to hide the Translation/Side-by-side tab and the Markdown/Excerpt/Annotations/AI/Download tool
    // groups (all of which consume jobId).
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
  // Collapse controller: manage left/right column collapse; opening a top-bar tool auto-expands the right column
  const panelCollapse = createReaderPanelCollapse({
    onChange: () => scheduleScaleRefresh(),
  });
  // Programmatic open("ai") at start should not wipe the user-persisted right-column collapse;
  // auto-expand only when the user clicks a top-bar tool
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
  // Three-column skeleton: left/right columns are resizable (persisted); refresh PDF zoom on drag
  createReaderColumnResizer({ onResize: () => scheduleScaleRefresh() }).bindEvents();
  // Left/right collapse handles (apply persisted collapse state first)
  panelCollapse.bindEvents();
  // Default: expand the right column (AI Q&A). Must run after chromeController.bindEvents(), see the timing
  // contract at the top of the file; if the user previously collapsed the right column, CSS keeps it collapsed.
  // Read-only source-document has no job → AI/Annotations/Markdown are not ready; do not expand the right column
  // (otherwise an "Preparing..." empty panel will hang there forever).
  if (!sourceOnly) {
    drawerStore.open("ai");
  }
  // After the start-open completes, only subsequent user clicks on the top-bar tool allow auto-expanding the right column
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

    // Double-click selection creates a clipped excerpt (imperative island; includes favorites drawer list rendering)
    const serverFavoritesPort = createReaderServerFavoritesPort({ jobId });
    createReaderSelectionFavorites({
      drawerController: drawerStore,
      jobId,
      setReaderMode: modeController.setMode,
      resolveQuote: resolveSelectionQuote,
      serverFavoritesPort,
    }).bindEvents();

    // Annotations panel ports (open/close subscription bridged from the drawer store by the drawer component)
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
          console.error("Export annotations to clipboard failed", error);
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

    // One-time injection on the React side: download menu context, annotations ports, AI chat ports
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




