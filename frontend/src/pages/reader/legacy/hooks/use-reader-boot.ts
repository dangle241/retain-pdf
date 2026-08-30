// Điều phối khởi động trình đọc (toàn bộ giai đoạn 2b): chuyển đầy đủ src/js/reader/index.js cũ.
// Chạy sau commit đầu của React (module mệnh lệnh tìm container theo ID, DOM phải có trước).
//
// Tái sử dụng theo kiểu mệnh lệnh (không chuyển sang React): toàn bộ PDF, interaction-flow, region-*,
// selection-favorites、favorites/*、markdown-preview、progress-presenter、
// controller chrome/mode, column-resizer/panel-collapse (lớp ngoài ba cột giữ giải pháp biến CSS,
// rrp chỉ quản lý Group hai PDF bên trong; ba cột cũ không phải flex cùng cấp, drawer là lớp phủ fixed +
// cascade body :has(); đổi lớp ngoài sang rrp phải viết lại toàn bộ reader-page.css, rủi ro pixel lớn hơn lợi ích nhiều).
//
// Phía React (inject qua runtime state): context menu tải xuống, port panel chú thích, port chat AI.
//
// Hợp đồng thời gian (cấp pixel): chrome.bindEvents() phải chạy trước drawerStore.open("ai");
// timer mờ đi được lên lịch khi "chưa có drawer mở", sau 1,6 giây body vào reader-chrome-muted,
// giống trạng thái trang cũ tại thời điểm chụp baseline.

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

// Bấm trích dẫn nhảy tới neo bản gốc (cùng cách định vị với mục đã lưu), giữ drawer mở;
// khi trích dẫn thuộc tài liệu khác, điều hướng tới trình đọc của tài liệu đó kèm tham số neo.
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

// Khi URL có neo (?page_idx=&block_id=), nhảy tới đó. Trang/regions mount bất đồng bộ và luồng bố cục khởi động
// sẽ đặt vị trí cuộn về đầu sau khi mount; jump thành công một lần chưa đủ, phải dựa vào "trang đích có
// thực sự nằm trong viewport hay không" để xác định; nếu chưa thì retry có backoff (hội tụ sau khi bố cục ổn định).
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
  // Render và bố cục PDF có thể kéo dài hơn 20 giây; trong thời gian đó scrollIntoView có thể bị
  // đặt lại bố cục nuốt mất; tiếp tục retry tới khi đúng vị trí, nhường ngay khi người dùng cuộn thủ công.
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
  // Không dùng requestAnimationFrame: trong tab nền, rAF bị tạm dừng và callback
  // không bao giờ chạy, khiến định vị neo âm thầm hỏng (đã gặp trong kiểm tra thực tế).
  globalThis.setTimeout(tryJump, 0);
}

// Khi file nguồn không khả dụng, điền nội dung rõ ràng vào cột nguồn (tài liệu mồ côi: có hàng document nhưng PDF nguồn chưa vào kho).
// #reader-pdf-empty mặc định là khối placeholder viền nét đứt không chữ; ghi trực tiếp textContent để có thông báo.
function showReaderSourceUnavailable() {
  showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
  const empty = document.getElementById("reader-pdf-empty");
  if (empty) {
    empty.textContent = "Tệp nguồn không khả dụng: tài liệu không có PDF gốc có thể đọc (có thể chỉ có bản ghi hoặc tệp chưa được thêm vào thư viện).";
  }
}

// "Đọc bản gốc" cho tài liệu thư viện (F4): không có tác vụ, chỉ mount cột tài liệu nguồn, chuyển sang chế độ source một cột, bỏ qua mọi
// chức năng phụ cần jobId (mục đã lưu/AI/chú thích/Markdown/interaction). URL tài liệu nguồn dùng
// /documents/:id/source.pdf (chế độ mock dùng kênh mock://).
async function mountSourceOnlyReader({
  documentId,
  pageState,
  modeController,
  applyBootProgress,
  syncBootProgress,
}) {
  // Tài liệu nguồn chỉ đọc luôn là một cột: **trước tiên** thu vào cột source đơn; dù tải nguồn thành công hay thất bại cũng không được
  // quay về trạng thái rỗng đối chiếu hai cột mặc định (nếu không, khi thiếu file nguồn sẽ có hai cột trống = cả màn hình trống).
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
      // Khi không lấy được file nguồn (ví dụ hàng tài liệu mồ côi: có bản ghi document nhưng PDF nguồn chưa vào kho,
      // /documents/:id/source.pdf trả 404), hiển thị thông báo rõ ràng trong cột đơn, không để trống.
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
  // Xác định tuyến trước (phân giải URL thuần, không tác dụng phụ): có tác vụ thì đọc đối chiếu đầy đủ; chỉ có document_id
  // là "Đọc bản gốc" của tài liệu thư viện (F4), phải bỏ qua mọi chức năng phụ và thanh công cụ cần jobId.
  const jobId = resolveReaderJobId(defaultReaderPageConfigPort);
  const sourceOnlyDocumentId = jobId ? "" : resolveReaderDocumentId();
  const sourceOnly = Boolean(sourceOnlyDocumentId);
  if (sourceOnly) {
    // CSS dựa vào đó để ẩn tab bản dịch/đối chiếu và nhóm công cụ Markdown/trích đoạn/chú thích/AI/tải xuống (đều cần jobId).
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
  // Controller thu gọn: quản lý thu gọn cột trái/phải; khi bấm mở công cụ trên thanh trên, tự mở cột phải để hiện nội dung.
  const panelCollapse = createReaderPanelCollapse({
    onChange: () => scheduleScaleRefresh(),
  });
  // open("ai") theo chương trình khi khởi động không được xóa trạng thái thu gọn cột phải đã lưu của người dùng; chỉ tự mở khi người dùng bấm công cụ thanh trên.
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
  // Khung ba cột: có thể kéo cột trái/phải để đổi chiều rộng (lưu bền vững), làm mới thu phóng PDF khi kéo.
  createReaderColumnResizer({ onResize: () => scheduleScaleRefresh() }).bindEvents();
  // Tay nắm thu gọn cột trái/phải (áp trạng thái thu gọn đã lưu trước).
  panelCollapse.bindEvents();
  // Mặc định mở cột phải (hỏi đáp AI). Phải chạy sau chromeController.bindEvents(), xem hợp đồng thời gian ở đầu file;
  // nếu người dùng đã thu cột phải lần trước thì CSS giữ trạng thái thu gọn.
  // Trạng thái tài liệu nguồn chỉ đọc không có tác vụ → AI/chú thích/Markdown đều không khả dụng, không mở cột phải (nếu không sẽ treo một panel trống
  // luôn "Đang chuẩn bị…").
  if (!sourceOnly) {
    drawerStore.open("ai");
  }
  // Sau khi open khởi động hoàn tất, chỉ cho phép tự mở cột phải khi người dùng bấm công cụ thanh trên về sau.
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

    // Nhấp đúp để khoanh chọn ảnh chụp trích đoạn (vùng mệnh lệnh độc lập, gồm render danh sách drawer favorites).
    const serverFavoritesPort = createReaderServerFavoritesPort({ jobId });
    createReaderSelectionFavorites({
      drawerController: drawerStore,
      jobId,
      setReaderMode: modeController.setMode,
      resolveQuote: resolveSelectionQuote,
      serverFavoritesPort,
    }).bindEvents();

    // Port panel chú thích (đăng ký đóng/mở được component drawer nối tới drawer store).
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
          console.error("Không thể xuất chú thích vào bộ nhớ tạm", error);
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

    // Inject một lần phía React: context menu tải xuống, port chú thích, port chat AI.
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
