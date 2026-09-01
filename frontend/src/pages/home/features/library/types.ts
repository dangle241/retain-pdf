// library 域total享Type: Grid卡片 item, controller 契约, viewPort / viewStore.
// 字段从 shapeDocumentCardItem / mergeLibraryJobItem / cardSignatureOf 反推.

import type { DialogStore } from "../../state/dialog-store.js";
import type {
  Store,
  StoreChangeMeta,
} from "../../composition/external.js";

// ─── Progress / 运行时 ───────────────────────────────────────────────

/** job Progressentries(top-level progress 或 runtime_status.progress) */
export type LibraryProgress = {
  current?: number | null;
  total?: number | null;
  percent?: number | null;
  unit?: string | null;
  [key: string]: unknown;
};

/** 运行时Status快照(轮询 / stage adapter 写入) */
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

/** background lane 合并时附带的Stage片段 */
export type LibraryBackgroundStage = {
  display_stage?: string;
  stage?: string;
  substage?: string;
  lane?: string;
  progress?: LibraryProgress;
  stage_detail?: string;
  [key: string]: unknown;
};

/** book 载荷上的Summary(merge 时回填 source_file_name / page_count) */
export type LibraryBookSummary = {
  source_file_name?: string;
  page_count?: number | null;
  title?: string;
  [key: string]: unknown;
};

// ─── Grid卡片 item ───────────────────────────────────────────────

/**
 * 书架Grid/List/详情total用的卡片投影.
 * - Translated: 真实 job_id + library/books 活态
 * - Library: library_only + 合成 job_id `doc:<document_id>`
 *
 * 扩展字段经 index signature 放行；已知字段尽量列全, 避免 any.
 */
export type LibraryCardItem = {
  // 身份
  job_id?: string;
  id?: string;
  document_id?: string;
  active_job_id?: string;
  library_only?: boolean;
  /** 打开详情时优先落在"Translation"Tab(Progress在 Tab 内, 不弹工作流窗) */
  prefer_translate_tab?: boolean;

  // 展示
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

  // Documents元Data
  reading_status?: string;
  tags?: string[];
  source_pdf_url?: string;
  bytes?: number | null;

  // job Status / stage
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

  // runtime merge / API 可能附带额外字段
  [key: string]: unknown;
};

/** job 中心命名别名(与 LibraryCardItem 同一形状) */
export type LibraryJobItem = LibraryCardItem;

/** History命名别名(recent-jobs 引擎侧) */
export type RecentJobItem = LibraryCardItem;

// ─── 卡片Action / 徽标 ─────────────────────────────────────────────

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

// ─── Documents API payload ────────────────────────────────────────────

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

/** POST /documents/:id/translate 返回(JobSubmissionView) */
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

/** 乐观删卡: 从Grid store 按 document_id 过滤(可选注入) */
export type RemoveLibraryDocumentsFn = (documentIds: string[]) => void;

/** 乐观改卡: 按 document_id 合并字段 */
export type PatchLibraryDocumentItemFn = (
  documentId: string,
  patch: Partial<LibraryCardItem>,
) => void;

export type LibraryControllerDeps = {
  documentRef?: Pick<Document, "dispatchEvent"> | null;
  libraryEventPort?: LibraryEventPort | null;
  reloadRecentJobs?: (opts?: ReloadRecentJobsOptions) => void | Promise<void>;
  /** 乐观RemoveGrid行；缺省则只靠 silent reload */
  removeLibraryDocuments?: RemoveLibraryDocumentsFn | null;
  /** 乐观UpdatesGrid行元Data */
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
   * Grid选中任务: 有 document_id → 详情Translation Tab + silent Progress；
   * no则 fallbackSelectJob(旧工作流弹窗).
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
  /** 详情内嵌Progress: 静默 startPolling, 不弹工作流, 不亮主Status区 */
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

// 再导出 StoreChangeMeta 供订阅方如需标注 meta 使用
export type { StoreChangeMeta };




