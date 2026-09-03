// library domain shared types: Grid card item, controller contract, viewPort / viewStore.
// Fields reverse-engineered from shapeDocumentCardItem / mergeLibraryJobItem / cardSignatureOf.

import type { DialogStore } from "../../state/dialog-store.js";
import type {
  Store,
  StoreChangeMeta,
} from "../../composition/external.js";

// ─── Progress / Runtime ───────────────────────────────────────────────

/** job progress entry (top-level progress or runtime_status.progress) */
export type LibraryProgress = {
  current?: number | null;
  total?: number | null;
  percent?: number | null;
  unit?: string | null;
  [key: string]: unknown;
};

/** Runtime status snapshot (written by polling / stage adapter) */
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

/** Stage fragment attached when merging background lanes */
export type LibraryBackgroundStage = {
  display_stage?: string;
  stage?: string;
  substage?: string;
  lane?: string;
  progress?: LibraryProgress;
  stage_detail?: string;
  [key: string]: unknown;
};

/** Summary on book payload (filled back during merge for source_file_name / page_count) */
export type LibraryBookSummary = {
  source_file_name?: string;
  page_count?: number | null;
  title?: string;
  [key: string]: unknown;
};

// ─── Grid Card Item ───────────────────────────────────────────────

/**
 * Card projection used by bookshelf Grid/List/detail for all.
 * - Translated: real job_id + library/books live state
 * - Library: library_only + synthesized job_id `doc:<document_id>`
 *
 * Extended fields allowed through index signature; known fields listed as fully as possible, avoiding any.
 */
export type LibraryCardItem = {
  // Identity
  job_id?: string;
  id?: string;
  document_id?: string;
  active_job_id?: string;
  library_only?: boolean;
  /** When opening details, prefer landing on the "Translation" tab (progress inside tab; no workflow popup) */
  prefer_translate_tab?: boolean;

  // Display
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

  // Documents metadata
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

  // runtime merge / API may carry extra fields
  [key: string]: unknown;
};

/** Job-centric naming alias (same shape as LibraryCardItem) */
export type LibraryJobItem = LibraryCardItem;

/** History naming alias (recent-jobs engine side) */
export type RecentJobItem = LibraryCardItem;

// ─── Card Action / Badge ─────────────────────────────────────────────

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

/** POST /documents/:id/translate response (JobSubmissionView) */
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

/** Optimistic card removal: filter from Grid store by document_id (optional injection) */
export type RemoveLibraryDocumentsFn = (documentIds: string[]) => void;

/** Optimistic card patch: merge fields by document_id */
export type PatchLibraryDocumentItemFn = (
  documentId: string,
  patch: Partial<LibraryCardItem>,
) => void;

export type LibraryControllerDeps = {
  documentRef?: Pick<Document, "dispatchEvent"> | null;
  libraryEventPort?: LibraryEventPort | null;
  reloadRecentJobs?: (opts?: ReloadRecentJobsOptions) => void | Promise<void>;
  /** Optimistically remove Grid rows; if absent, relies on silent reload only */
  removeLibraryDocuments?: RemoveLibraryDocumentsFn | null;
  /** Optimistically update Grid row metadata */
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
   * Grid job selection: has document_id → detail Translation tab + silent progress;
   * otherwise falls back to fallbackSelectJob (old workflow dialog).
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
  /** Detail embedded progress: silently start polling, no workflow popup, main status area not lit */
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

// Re-export StoreChangeMeta for subscribers that need to annotate meta
export type { StoreChangeMeta };




