// ReaderStart编排(Phase 2b 全量):旧 src/js/reader/index.js 的完整移植.
// React 首次 commit 后运行(命令式模块按 id 查找容器,DOM 必须先就位).
//
// 命令式复用(不 React 化):pdf 全家, interaction-flow, region-*, 
// selection-favorites, favorites/*, markdown-preview, progress-presenter, 
// chrome/mode 控制器, column-resizer/panel-collapse(三栏外层维持 CSS 变量方案,
// rrp 只统内层双 PDF Group——旧三栏不yes同级 flex,抽屉yes fixed 覆盖层 +
// body :has() 级联,改 rrp 外层要重写整片 reader-page.css,像素风险远大于收益).
//
// React 侧(经 runtime state 注入):下载菜单 context, annotations面板端口, AI chat 端口.
//
// 时序契约(像素级):chrome.bindEvents() 必须先于 drawerStore.open("ai")——
// 淡出定时器在"尚None抽屉打开"时排上,1.6s 后 body 进入 reader-chrome-muted,
// 与旧pages在基线截图时刻的形态一致.

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

// 引用点击跳Source锚点(与Favorite跳转同一套Locate),抽屉保持打开;
// 引用属于其他Documents时,导航到那documents的Reader并带上锚点参数
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

// URL 带锚点(?page_idx=&block_id=)时跳过去.Pages/regions 异step挂载,且Start布局
// Workflow会在挂载后把滚动位置重置回顶部——jump 一次成功不算数,必须按"目标pagesyesno
// 真在视口内"判定,未就位则退避Retry(布局稳定后即收敛).
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
  // PDF Rendering与布局可能持续二十s以上,期间 scrollIntoView 会被
  // 布局重置吞掉;持续Retry到就位,用户一旦手动滚动立即让位.
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
  // 不用 requestAnimationFrame:后台Tagspages里 rAF 被挂起,回调
  // 永远不触发,锚点Locate会静默失效(实测踩中).
  globalThis.setTimeout(tryJump, 0);
}

// 源Files不Ready时给源栏填一entries明确文案(孤儿Documents:有 document 行但没AddedSource PDF).
// #reader-pdf-empty 默认yesNone文字的虚线占位块,直接写 textContent 让它有话可说.
function showReaderSourceUnavailable() {
  showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
  const empty = document.getElementById("reader-pdf-empty");
  if (empty) {
    empty.textContent = "源Files不Ready: 该Documents没有可读取的Source PDF(可能只有记录, 未AddedFiles).";
  }
}

// LibraryDocuments"Read Source"(F4):None job,只挂源Documents一栏,切 source 单栏模式,跳过所有
// 吃 jobId 的副Tools(Favorite/AI/annotations/markdown/interaction).源Documents URL 走
// /documents/:id/source.pdf(mock 模式走 mock:// 通道).
async function mountSourceOnlyReader({
  documentId,
  pageState,
  modeController,
  applyBootProgress,
  syncBootProgress,
}) {
  // 只读源Documents全程都yes单栏——**先**收进 source 单栏,None论源加载成功Failed都不该
  // 退回默认的两栏Side-by-side空态(no则源Files缺失时会yes两个空白栏 = 一片空白).
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
      // 源Files取不到(如孤儿Documents行:有 document 记录但没AddedSource PDF,
      // /documents/:id/source.pdf 404)——单栏里给一entries明确文案,不留空白.
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
  // 先定路线(纯 URL parse,None副作用):有 job 走完整Side-by-side Reader;只有 document_id
  // yesLibraryDocuments"Read Source"(F4),要跳过所有吃 jobId 的副Tools与Tools栏.
  const jobId = resolveReaderJobId(defaultReaderPageConfigPort);
  const sourceOnlyDocumentId = jobId ? "" : resolveReaderDocumentId();
  const sourceOnly = Boolean(sourceOnlyDocumentId);
  if (sourceOnly) {
    // CSS 据此隐藏Translation/Side-by-side tab 与 Markdown/Excerpt/annotations/AI/下载Tools组(All吃 jobId).
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
  // 折叠控制器:Manage左右栏折叠;顶栏点开Tools时自动展开右栏亮出内容
  const panelCollapse = createReaderPanelCollapse({
    onChange: () => scheduleScaleRefresh(),
  });
  // Start时的程序化 open("ai") 不应清掉用户持久化的右栏折叠;仅用户点顶栏Tools才自动展开
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
  // 三栏骨架:左右栏可拖拽调宽(持久化),拖动时刷新 PDF 缩放
  createReaderColumnResizer({ onResize: () => scheduleScaleRefresh() }).bindEvents();
  // 左右栏折叠把手(先应用持久折叠态)
  panelCollapse.bindEvents();
  // 默认展开右栏(AI Q&A).必须晚于 chromeController.bindEvents(),见Files头时序契约;
  // 若用户上次折叠了右栏则由 CSS 保持折叠.
  // 源Documents只读态没有 job → AI/annotations/Markdown 都不Ready,不展开右栏(no则会挂着一个
  // 永远"Preparing..."的空面板).
  if (!sourceOnly) {
    drawerStore.open("ai");
  }
  // Start open Done后,后续用户点顶栏Tools才允许自动展开右栏
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

    // 双击框选Clipped excerpt(命令式孤岛,含 favorites 抽屉ListRendering)
    const serverFavoritesPort = createReaderServerFavoritesPort({ jobId });
    createReaderSelectionFavorites({
      drawerController: drawerStore,
      jobId,
      setReaderMode: modeController.setMode,
      resolveQuote: resolveSelectionQuote,
      serverFavoritesPort,
    }).bindEvents();

    // annotations面板端口(开合订阅由抽屉组件桥接 drawer store)
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
          console.error("导出annotations到剪贴板Failed", error);
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

    // React 侧一次性注入:下载菜单 context, annotations端口, AI chat 端口
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




