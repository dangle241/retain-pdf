// Kiểu dùng chung miền library: mục thẻ lưới, hợp đồng controller, viewPort / viewStore.
// Trường được suy ngược từ shapeDocumentCardItem / mergeLibraryJobItem / cardSignatureOf.

import type { DialogStore } from "../../state/dialog-store.js";
import type {
  Store,
  StoreChangeMeta,
} from "../../composition/external.js";

// ─── Tiến độ / runtime ────────────────────────────────────────────

/** Thanh tiến độ job (progress cấp trên hoặc runtime_status.progress). */
export type LibraryProgress = {
  current?: number | null;
  total?: number | null;
  percent?: number | null;
  unit?: string | null;
  [key: string]: unknown;
};

/** Snapshot trạng thái runtime, do poll / stage adapter ghi. */
export type LibraryRuntimeStatus = {
  stageKey?: string;
  publicStage?: string;
  source?: string;
  lane?: string;
  substage?: string;
  detail?: string;
  progress?: LibraryProgress;
  [key: string]: unknown;
};

/** Đoạn giai đoạn đi kèm khi hợp nhất background lane. */
export type LibraryBackgroundStage = {
  display_stage?: string;
  stage?: string;
  substage?: string;
  lane?: string;
  progress?: LibraryProgress;
  stage_detail?: string;
  [key: string]: unknown;
};

/** Tóm tắt trên payload book, điền source_file_name / page_count khi merge. */
export type LibraryBookSummary = {
  source_file_name?: string;
  page_count?: number | null;
  title?: string;
  [key: string]: unknown;
};

// ─── Mục thẻ lưới ─────────────────────────────────────────────────

/**
 * Projection thẻ dùng chung cho lưới/danh sách/chi tiết giá sách.
 * - Đã dịch: job_id thật + trạng thái sống library/books.
 * - Thư viện: library_only + job_id tổng hợp `doc:<document_id>`.
 *
 * Trường mở rộng được phép qua index signature; liệt kê đầy đủ trường đã biết để tránh any.
 */
export type LibraryCardItem = {
  // Định danh.
  job_id?: string;
  id?: string;
  document_id?: string;
  active_job_id?: string;
  library_only?: boolean;
  /** Khi mở chi tiết, ưu tiên tab "Dịch"; tiến độ trong tab, không bật cửa sổ workflow. */
  prefer_translate_tab?: boolean;

  // Hiển thị.
  title?: string;
  display_name?: string;
  source_file_name?: string;
  page_count?: number | null;
  cover_url?: string;
  thumbnail_url?: string;
  updated_at?: string;
  created_at?: string;
  added_at?: string;
  last_opened_at?: string | null;

  // Siêu dữ liệu tài liệu.
  reading_status?: string;
  tags?: string[];
  source_pdf_url?: string;
  bytes?: number | null;

  // Trạng thái / stage của job.
  status?: string;
  stage?: string;
  display_stage?: string;
  substage?: string;
  lane?: string;
  stage_detail?: string;
  progress?: LibraryProgress;
  runtime_status?: LibraryRuntimeStatus;
  background_stages?: LibraryBackgroundStage[];
  stage_snapshot?: LibraryRuntimeStatus;
  book_summary?: LibraryBookSummary;
  workflow?: string;
  job_type?: string;

  // Runtime merge / API có thể kèm trường bổ sung.
  [key: string]: unknown;
};

/** Bí danh đặt tên theo job, cùng hình dạng với LibraryCardItem. */
export type LibraryJobItem = LibraryCardItem;

/** Bí danh tên cũ ở phía engine recent-jobs. */
export type RecentJobItem = LibraryCardItem;

// ─── Thao tác thẻ / huy hiệu ───────────────────────────────────────

export type BookCardAction = {
  id: string;
  label: string;
  icon?: string;
  className?: string;
  disabled?: boolean;
  onClick?: (event?: unknown, current?: LibraryCardItem) => void;
};

export type BookCardActionHandlers = {
  onReader?: (jobId: string) => void;
  onReadSource?: (documentId: string) => void;
  onTranslate?: (item: LibraryCardItem) => void;
};

export type LibraryCardBadge = {
  label: string;
  icon: string;
  cls: string;
};

// ─── Payload API tài liệu ─────────────────────────────────────────

export type TranslateDocumentPayload = {
  ocr?: {
    page_ranges?: string;
    [key: string]: unknown;
  };
  translation?: {
    start_page?: number;
    end_page?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Giá trị trả về từ POST /documents/:id/translate (JobSubmissionView). */
export type JobSubmissionView = {
  job_id?: string;
  id?: string;
  document_id?: string;
  status?: string;
  [key: string]: unknown;
};

export type UpdateDocumentPayload = {
  title?: string;
  reading_status?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type DeleteCardTarget = {
  documentId?: string;
  jobId?: string;
};

export type DeleteDocumentsResult = {
  confirmed: number;
  failed: number;
};

export type ReloadRecentJobsOptions = {
  reset?: boolean;
  silent?: boolean;
  [key: string]: unknown;
};

// ─── Controller ──────────────────────────────────────────────────

export type LibraryEventPort = {
  requestRefresh?: (opts?: {
    force?: boolean;
    delay?: number;
    [key: string]: unknown;
  }) => void;
  publishJobCreated?: (job?: LibraryCardItem | Record<string, unknown> | null) => void;
  publishJobUpdated?: (job?: LibraryCardItem | Record<string, unknown> | null) => void;
};

/** Xóa thẻ lạc quan: lọc grid store theo document_id (có thể inject). */
export type RemoveLibraryDocumentsFn = (documentIds: string[]) => void;

/** Cập nhật thẻ lạc quan: hợp nhất trường theo document_id. */
export type PatchLibraryDocumentItemFn = (
  documentId: string,
  patch: Partial<LibraryCardItem>,
) => void;

export type LibraryControllerDeps = {
  documentRef?: Pick<Document, "dispatchEvent"> | null;
  libraryEventPort?: LibraryEventPort | null;
  reloadRecentJobs?: (opts?: ReloadRecentJobsOptions) => void | Promise<void>;
  /** Xóa hàng lưới lạc quan; nếu bỏ qua thì chỉ dựa vào silent reload. */
  removeLibraryDocuments?: RemoveLibraryDocumentsFn | null;
  /** Cập nhật lạc quan siêu dữ liệu của hàng lưới. */
  patchLibraryDocumentItem?: PatchLibraryDocumentItemFn | null;
  deleteJob?: (jobId: string) => void | Promise<void>;
  buildTranslateConfig?: (
    pageRanges?: string,
  ) => TranslateDocumentPayload | Record<string, unknown>;
  startPolling?: (
    jobId: string,
    options?: { silent?: boolean; publishLibrary?: boolean; showWorkflow?: boolean },
  ) => void;
  hideStatusArea?: () => void;
};

export type LibraryController = {
  bookDetailStore: DialogStore<LibraryCardItem | null>;
  openSourceReader: (documentId?: string | null) => void;
  storeOnly: () => void;
  translateDocument: (
    documentId?: string | null,
    payload?: TranslateDocumentPayload,
  ) => Promise<JobSubmissionView | null>;
  deleteDocument: (documentId?: string | null) => Promise<void>;
  deleteDocuments: (
    documentIds?: Array<string | null | undefined>,
  ) => Promise<DeleteDocumentsResult>;
  deleteCard: (target?: DeleteCardTarget) => void;
  openBookDetail: (item?: LibraryCardItem | null) => void;
  /**
   * Chọn tác vụ từ lưới: có document_id → tab Dịch trong chi tiết + tiến độ nền;
   * nếu không thì fallbackSelectJob (hộp thoại workflow cũ).
   */
  selectJobForDetail: (
    jobId?: string | null,
    options?: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      fallbackSelectJob?: (jobId: string) => void;
    },
  ) => void;
  updateDocument: (
    documentId?: string | null,
    payload?: UpdateDocumentPayload,
  ) => Promise<unknown>;
  /** Tiến độ nhúng trong chi tiết: startPolling âm thầm, không mở workflow và không làm sáng vùng trạng thái chính. */
  attachJobProgress: (jobId?: string | null) => void;
};

// ─── View store / viewPort ───────────────────────────────────────

export type LibraryViewMode = "loading" | "empty" | "error" | "list" | string;

export type LibraryViewState = {
  mode: LibraryViewMode;
  message: string;
  hasMore: boolean;
  loadMoreLoading: boolean;
  query: string;
};

export type LibraryViewActions = {
  setLoading(state: LibraryViewState): LibraryViewState;
  setEmpty(state: LibraryViewState, message?: string): LibraryViewState;
  setErrorReset(state: LibraryViewState, message?: string): LibraryViewState;
  clearLoadMoreLoading(state: LibraryViewState): LibraryViewState;
  setList(state: LibraryViewState, hasMore?: boolean): LibraryViewState;
  setLoadMoreLoading(state: LibraryViewState): LibraryViewState;
  setQuery(state: LibraryViewState, query?: string): LibraryViewState;
};

export type LibraryViewStore = Store<LibraryViewState, LibraryViewActions>;

export type RecentJobsViewPortHandlers = {
  onOpen?: ((jobId: string) => void) | null;
  onLoadMore?: (() => void) | null;
  onSearch?: ((query: string) => void) | null;
  isSuspended?: () => boolean;
};

export type RecentJobsReactViewPortOptions = {
  store?: LibraryViewStore;
};

export type AutoLoadCheckOptions = {
  isSuspended?: boolean;
  [key: string]: unknown;
};

export type RecentJobsReactViewPort = {
  store: LibraryViewStore;
  handlersRef: { current: RecentJobsViewPortHandlers };
  bindEvents: (handlers?: Partial<RecentJobsViewPortHandlers>) => void;
  hasView: () => boolean;
  registerAutoLoadChecker: (
    checker: ((options?: AutoLoadCheckOptions) => void) | null | undefined,
  ) => () => void;
  renderEmpty: (message?: string, invocationSummary?: unknown) => void;
  renderError: (message?: string, options?: { reset?: boolean }) => void;
  renderList: (options?: { hasMore?: boolean; [key: string]: unknown }) => void;
  renderLoading: () => void;
  replaceCard: (...args: unknown[]) => boolean;
  scheduleAutoLoadCheck: (options?: AutoLoadCheckOptions) => void;
  setDialogOpen: (...args: unknown[]) => void;
  setLoadMoreLoading: () => void;
};

// Xuất thêm StoreChangeMeta để bên đăng ký có thể gắn meta khi cần.
export type { StoreChangeMeta };
