// recent-jobs ports + library controller + collections。

import {
  API_PREFIX,
  APP_EVENTS,
  createStore,
  createRecentJobsStatePort,
  createRecentJobActions,
  createRecentJobsRuntimePort,
  createRecentJobsReaderPort,
  createRecentJobsNavigationPort,
  createRecentJobsLibraryRefreshPort,
  readActiveJobId,
  deleteLibraryBook,
  fetchDocumentList,
  fetchLibraryBookList,
  createDocumentLibraryResource,
} from "./external.js";
import {
  createLibraryController,
  createRecentJobsReactViewPort,
} from "../features/library/index.js";
import { createCollectionsController } from "../features/collections/controller.js";
import { createCollectionManageDialogStore } from "../features/collections/collection-manage-dialog-store.js";
import type {
  CollectionsController,
  CollectionsReloadSignal,
  HomeFeatures,
  RecentJobActions,
} from "./types.js";
import type {
  LibraryController,
  RecentJobsReactViewPort,
  ReloadRecentJobsOptions,
} from "../features/library/types.js";
import type { DialogStore } from "../state/dialog-store.js";
import type { LibraryCardItem } from "../features/library/types.js";

type ReaderAnchor = {
  pageIdx?: number | null;
  blockId?: string;
} | null;

type CreateLibraryDomainArgs = {
  features: HomeFeatures;
  documentRef: Document;
  statusArea: { setVisible: (visible: boolean) => void };
};

export function createLibraryDomain({ features, documentRef, statusArea }: CreateLibraryDomainArgs) {
  const libraryEventPort = createRecentJobsLibraryRefreshPort({ target: documentRef });
  const recentJobsStatePort = createRecentJobsStatePort();
  const recentJobsViewPort = createRecentJobsReactViewPort() as RecentJobsReactViewPort;
  const documentLibraryResource = createDocumentLibraryResource({
    fetchDocumentList,
    fetchLibraryBookList,
    apiPrefix: API_PREFIX,
  });

  // Tham số mặc định `= {}` của factory port lớp dưới làm mất các trường không mặc định như openJob / closeDialog.
  const recentJobsJobRuntimePort = createRecentJobsRuntimePort({
    // Bấm tác vụ trong lưới: chỉ poll silent, tiến độ ở tab chi tiết; không mở workflow chính.
    openJob: (jobId: string) => (
      features.jobRuntimeFeature.startPolling(jobId, {
        silent: true,
        showWorkflow: false,
        publishLibrary: false,
      })
    ),
    // Khôi phục tác vụ đang hoạt động khi khởi động lạnh: silent, không mở vùng trạng thái chính hay phát sự kiện create tới thư viện.
    recoverJob: (jobId: string) => (
      features.jobRuntimeFeature.startPolling(jobId, { silent: true })
    ),
    currentJobId: () => features.jobRuntimeFeature.currentJobId() || "",
  });

  const recentJobsReaderPort = createRecentJobsReaderPort({
    openReader: (jobId: string, anchor: ReaderAnchor = null) => {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) return;
      // Trình đọc không cần mở vùng workflow chính/phát create tới thư viện; chỉ cần theo dõi job bằng silent.
      features.jobRuntimeFeature.startPolling(normalizedJobId, { silent: true });
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.openReaderRequested, {
        detail: {
          jobId: normalizedJobId,
          pageIdx: Number.isFinite(anchor?.pageIdx) ? anchor.pageIdx : null,
          blockId: anchor?.blockId || "",
        },
      }));
    },
  });

  const recentJobsNavigationPort = createRecentJobsNavigationPort({
    closeDialog: () => {},
    currentJobId: () => features.jobRuntimeFeature.currentJobId() || "",
    jobRuntimePort: recentJobsJobRuntimePort,
    readerPort: recentJobsReaderPort,
    doc: documentRef,
  });

  // navigationPort có thể dự phòng startPolling/openReader/closeRecentJobsDialog; chữ ký vẫn đánh dấu bắt buộc.
  const recentJobActions = createRecentJobActions({
    apiPrefix: API_PREFIX,
    deleteLibraryBook,
    activeJobRecoveryPort: { readActiveJobId },
    navigationPort: recentJobsNavigationPort,
    renderCurrentRecentJobs: () => {},
    renderRecentJobsEmpty: recentJobsViewPort.renderEmpty,
    renderRecentJobsError: recentJobsViewPort.renderError,
    statePort: recentJobsStatePort,
  }) as RecentJobActions;

  const libraryController = createLibraryController({
    documentRef,
    libraryEventPort,
    reloadRecentJobs: async (opts?: ReloadRecentJobsOptions) => {
      await features.recentJobsFeature.loadRecentJobs(opts);
    },
    removeLibraryDocuments: (documentIds: string[]) => {
      const idSet = new Set((documentIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean));
      if (!idSet.size) {
        return;
      }
      const { items } = recentJobsStatePort.getSnapshot();
      recentJobsStatePort.setItems(
        items.filter((item) => !idSet.has(`${item?.document_id || ""}`.trim())),
      );
    },
    patchLibraryDocumentItem: (documentId: string, patch) => {
      const id = `${documentId || ""}`.trim();
      if (!id || !patch || typeof patch !== "object") {
        return;
      }
      const { items } = recentJobsStatePort.getSnapshot();
      recentJobsStatePort.setItems(
        items.map((item) => (
          `${item?.document_id || ""}`.trim() === id ? { ...item, ...patch } : item
        )),
      );
    },
    deleteJob: async (jobId: string) => {
      await recentJobActions.deleteJob(jobId);
    },
    buildTranslateConfig: (pageRanges?: string) => features.workflowFeature.buildTranslateJobConfig(pageRanges),
    startPolling: (jobId: string, options?: { silent?: boolean }) => {
      features.jobRuntimeFeature.startPolling(jobId, options);
    },
    hideStatusArea: () => statusArea.setVisible(false),
  }) as LibraryController;

  return {
    libraryEventPort,
    recentJobsStatePort,
    recentJobsViewPort,
    documentLibraryResource,
    recentJobsJobRuntimePort,
    recentJobsReaderPort,
    recentJobsNavigationPort,
    recentJobActions,
    libraryController,
    bookDetailStore: libraryController.bookDetailStore as DialogStore<LibraryCardItem | null>,
    collectionsController: createCollectionsController({ apiPrefix: API_PREFIX }) as unknown as CollectionsController,
    collectionManageDialogStore: createCollectionManageDialogStore(),
    collectionsReloadSignal: createStore<
      { version: number },
      { bump: (state: { version: number }) => { version: number } }
    >({
      name: "collectionsReload",
      initialState: { version: 0 },
      actions: {
        bump: (state) => ({ version: state.version + 1 }),
      },
    }) as CollectionsReloadSignal,
  };
}
