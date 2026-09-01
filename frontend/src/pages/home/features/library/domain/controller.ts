// Library (Document) Domain action set ââ Extracted from composition.js (Refactor â ).
//
// composition.js only responsible for one new + pipe return value in services.library.actions.
//
// Dependency injected via parameter (do not directly import composition scope-related items):
// - documentRef / libraryEventPort / reloadRecentJobs / deleteJob / buildTranslateConfig
// - startPolling: job-runtime Start monitoring specific job（composition Pass closure.,fetch upon call feature）
// - hideStatusArea: Update workflow status silently. Avoid lifting main page workflow status area.
//
// Progress integration contract (with selectJob Intentional fork:
// - selectJob (recent-jobs/actions) â open workflow popup + startPolling
// - attachJobProgress(this controller）→ only startPollingno popup, no main status area highlight
// Book Details "Translation" Tab Embed StatusCard Use.

import { createBookDetailDialogStore } from "../detail/book-detail-dialog-store.js";
import type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "../types.js";
import {
  translateDocument,
  deleteDocument,
  patchDocument,
  API_PREFIX,
  APP_EVENTS,
} from "../../../composition/external.js";

type ErrorLike = {
  message?: string;
  status?: number;
} | string | null | undefined;

export function createLibraryController({
  documentRef,
  libraryEventPort,
  reloadRecentJobs,
  removeLibraryDocuments,
  patchLibraryDocumentItem,
  deleteJob,
  buildTranslateConfig,
  startPolling,
  hideStatusArea,
}: LibraryControllerDeps = {}): LibraryController {
  const bookDetailStore = createBookDetailDialogStore();
  const translatingDocumentIds = new Set<string>();

  function dispatchAppEvent(name: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(
        new globalThis.CustomEvent(name, detail === undefined ? undefined : { detail }),
      );
    }
  }

  async function reload(opts?: ReloadRecentJobsOptions) {
    await reloadRecentJobs?.(opts);
  }

// F4 Holdings document "Read Original": no job, dispatch openReaderRequested with documentId,
// ReaderDialog uses document_id to open read-only source viewer (same event contract as card).
  function openSourceReader(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    dispatchAppEvent(APP_EVENTS.openReaderRequested, { documentId: normalizedId, pageIdx: null, blockId: "" });
  }

// F3 "Import only, no translation": PDF at **Upload complete** backend already built. document has
  // (POST /uploads → upsert_document_from_upload,document_id = Content hash),
// So "Import only" needs no new interfaces. ââ Exactly **Translation not submitted job**: Close workflow dialog
// (its close() in passing. resetUploadSession + scheduleRefresh soft in bindings).
  // No extra force refreshAvoid close dialog twice.
  function storeUploadedDocumentOnly() {
    dispatchAppEvent(APP_EVENTS.closeTranslationWorkflow);
  }

  // Translation failed. Please try again.:Backend most common failure is"Not configured OCR/credentials"
// (e.g., if paddle_token is required), original text is meaningless to users, provide actionable prompt; rest
  // Error: surface backend message at minimum.(No longer silent)。
  function friendlyTranslateError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
const credentialish = /(token|key|å­æ®|Token|å¯é¥|credential)/i.test(message);
const missing = /(required|éè¦|ç¼º|Not configured|not configured|missing)/i.test(message);
    if (credentialish && missing) {
return "Translation requires OCR / Translate credentials to be configured first. Please set them in configuration and retry.";
    }
    return message || "Translation failed. Retry later.";
  }

// F5 Collection docs "Translate later": reuse existing upload to start book translation job, Backend backfill
// active_job_id; Reload page once after. The document will use the actual job_id to re-enter grid, existing
// polling engine (active-refresh pulls job payload by job_id) Naturally take over progress.
  //
// On failure: **Throw to caller** (Book details modal nested within modal. Show setError + Keep dialog open).
  // Early: push to grid. renderError,Translation entry moved from card to modal.,Grid error bar only in
// "Grid empty" Show only when full grid. Otherwise user sees nothing. Render as "no response when clicked" (missing
  // OCR Credential truth bug)。
// Assemble actual backend payload. job config: Assemble full credentials from configured ones. ocr(PaddleOCR)+
  // translation(DeepSeek)Base(buildTranslateConfig),Pass page range from modal.
  // (payload.ocr.page_ranges / payload.translation.start_page-end_page)Stack.
  // Backend receives nothing without credentials. provider,Defaults to deprecated. OCR provider and fails.
  function assembleTranslatePayload(overrides: TranslateDocumentPayload = {}): TranslateDocumentPayload {
    const pageRanges = `${overrides?.ocr?.page_ranges || ""}`.trim();
    const base = (buildTranslateConfig?.(pageRanges) || {}) as TranslateDocumentPayload;
    return {
      ...(base.ocr ? { ocr: { ...base.ocr, ...(overrides.ocr || {}) } } : (overrides.ocr ? { ocr: overrides.ocr } : {})),
      ...(base.translation ? { translation: { ...base.translation, ...(overrides.translation || {}) } } : (overrides.translation ? { translation: overrides.translation } : {})),
    };
  }

  /**
   * Silent integration task progress (book details translation). Check status. Tab → bd-job-status-inner）。
   * - silent startPollingWrite only. statusCardStore, without raising the workflow area or broadcasting create
   * - Never dispatch openTranslationWorkflowProgress lives in detail view, not modal.
* - Force hide Main status area, avoid #status-section / Main StatusCard Upstage
   */
  function attachJobProgress(jobId?: string | null) {
    const id = `${jobId || ""}`.trim();
    if (!id || id.startsWith("doc:")) {
      return;
    }
    hideStatusArea?.();
    startPolling?.(id, { silent: true, showWorkflow: false, publishLibrary: false });
    hideStatusArea?.();
  }

  /**
   * Immediate feedback on successful translation (no full page reload):
* 1) Details payload Immediately attach real job_id â Translation Tab Switch to StatusCard
   * 2) attachJobProgress → Progress ring/Stage flow starting now.
* 3) publishJobUpdated by document_id Update original card in-place. Disallow second insertion.
   * 4) Backend silent Sync alignment with server to prevent flickering. loading
   */
  function promoteDocumentToJob(
    documentId: string,
    result: JobSubmissionView | null | undefined,
  ) {
    const jobId = `${result?.job_id || result?.id || ""}`.trim();
    if (!jobId) {
      return;
    }
    const dialogState = bookDetailStore.getState();
    const base = (dialogState.payload || {}) as LibraryCardItem;
    const status = `${result?.status || "queued"}`.trim() || "queued";
    const stage = `${result?.stage || result?.display_stage || "queued"}`.trim() || "queued";

    if (dialogState.open && `${base.document_id || ""}`.trim() === documentId) {
      bookDetailStore.open({
        ...base,
        job_id: jobId,
        active_job_id: jobId,
        library_only: false,
        status,
        stage,
        display_stage: `${result?.display_stage || stage}`,
      });
    }

// Use JobUpdated: Modify original card in-place by document_id. Prevent homepage from inserting new book card.
    const previousJobId = `${base.job_id || ""}`.trim();
    libraryEventPort?.publishJobUpdated?.({
      job_id: jobId,
      source_job_id: previousJobId && previousJobId !== jobId ? previousJobId : undefined,
      document_id: documentId,
      active_job_id: jobId,
      library_only: false,
      status,
      stage,
      display_stage: `${result?.display_stage || stage}`,
      title: base.title,
      display_name: base.display_name || base.title,
      page_count: base.page_count,
      cover_url: base.cover_url,
      thumbnail_url: base.thumbnail_url,
    });
    attachJobProgress(jobId);
  }

  async function translateLibraryDocument(
    documentId?: string | null,
    payload: TranslateDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId || translatingDocumentIds.has(normalizedId)) {
      return null;
    }
    translatingDocumentIds.add(normalizedId);
    let result: JobSubmissionView | null = null;
    try {
      result = (await translateDocument(
        API_PREFIX,
        normalizedId,
        assembleTranslatePayload(payload),
      )) as JobSubmissionView;
    } catch (error) {
      throw new Error(friendlyTranslateError(error as ErrorLike));
    } finally {
      translatingDocumentIds.delete(normalizedId);
    }

    // Resume progress immediately. + Update details/Grid; no longer full-page reloadSingle-GPU at runtime. patch Advance)
    promoteDocumentToJob(normalizedId, result);
    return result;
  }

// Document-level deletion (Backend added. After DELETE /documents/:id): delete document + all associated
  // job/upload/File. Collection docs and translated docs unified path here(Cards carry all. document_id)。
  function friendlyDocumentDeleteError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const status = typeof error === "object" && error ? error.status : undefined;
    if (status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
? `This document has ${count} bookmarks. Please delete bookmarks before deleting the document.`
: "This document has bookmark references. Please delete related bookmarks before deleting the document.";
    }
    return message || "Failed to delete document";
  }

// Same translation: Throw failure to caller (Display in modal). Optimistically delete card on success + silent soft reload,
// No longer await non-silent full page loading (One root cause of homepage flash-empty.)
  async function deleteLibraryDocument(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    try {
      await deleteDocument(API_PREFIX, normalizedId);
    } catch (error) {
      throw new Error(friendlyDocumentDeleteError(error as ErrorLike));
    }
    removeLibraryDocuments?.([normalizedId]);
    void reload({ reset: true, silent: true });
  }

// Batch delete: API still deletes one by one. Remove grid optimistic removal + Once silent soft reload.
  async function deleteLibraryDocuments(
    documentIds: Array<string | null | undefined> = [],
  ): Promise<DeleteDocumentsResult> {
    const ids = [...new Set((documentIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean))];
    if (!ids.length) {
      return { confirmed: 0, failed: 0 };
    }
    const results = await Promise.allSettled(ids.map((id) => deleteDocument(API_PREFIX, id)));
    const confirmedIds = ids.filter((_, index) => results[index]?.status === "fulfilled");
    const confirmed = confirmedIds.length;
    if (confirmedIds.length) {
      removeLibraryDocuments?.(confirmedIds);
    }
    void reload({ reset: true, silent: true });
    return { confirmed, failed: results.length - confirmed };
  }

// Card deletion entry: if document_id exists, use document-level deletion (Delete entire document + all associated jobs);
// If none (Extremely rare runtime insertion job item), revert to previous version. job deletion, preserve original behavior.
  function deleteCard(target: DeleteCardTarget = {}) {
    const documentId = `${target?.documentId || ""}`.trim();
    if (documentId) {
      // fire-and-forget:deleteLibraryDocument Now throw,Swallow to avoid unhandled rejection.
      // (Card-level entry currently has no consumer.,Card deletion merged into details modal.)。
      void deleteLibraryDocument(documentId).catch(() => {});
      return;
    }
    deleteJob?.(`${target?.jobId || ""}`.trim());
  }

  function shouldPreferTranslateTab(item?: LibraryCardItem | null) {
    if (item?.prefer_translate_tab) return true;
    const status = `${item?.status || ""}`.trim().toLowerCase();
    if (status === "failed" || status === "running" || status === "queued" || status === "pending") {
      return true;
    }
    const jobId = `${item?.job_id || item?.active_job_id || ""}`.trim();
// Has real job and not collection composite id â Default view: translation. Tab progress
    if (jobId && !jobId.startsWith("doc:") && !item?.library_only) {
      return true;
    }
    return false;
  }

  // Book details modal: open on card click. Running/Default fallback translation failed Tab + silent Progress.
  // Never open #translation-workflow-dialog。
  function openBookDetail(item?: LibraryCardItem | null) {
    if (!item) return;
    const documentId = `${item.document_id || ""}`.trim();
    const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
    // At least document_id or real job_id
    if (!documentId && (!jobId || jobId.startsWith("doc:"))) {
      return;
    }
    const prefer = shouldPreferTranslateTab(item);
    bookDetailStore.open({
      ...item,
      prefer_translate_tab: prefer || Boolean(item.prefer_translate_tab),
    });
    if (jobId && !jobId.startsWith("doc:")) {
      attachJobProgress(jobId);
    }
  }

  /**
   * Grid「Selected task.」Always enter detail translation Tab + silent Progress.
* No longer fallback to openTranslationWorkflowOld modal only for bottom "Add".
   */
  function selectJobForDetail(
    jobId?: string | null,
    options: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      /** @deprecated Library grid no longer pops workflow; retain param compatibility test injection */
      fallbackSelectJob?: (jobId: string) => void;
    } = {},
  ) {
    const id = `${jobId || ""}`.trim();
    if (!id) {
      return;
    }
    const item = options.findItem?.(id) || null;
    if (item) {
      openBookDetail({
        ...item,
        prefer_translate_tab: true,
      });
      return;
    }
    // Row not found in grid yet: still use job_id Open detail shell + silent poll, no old window popup
    openBookDetail({
      job_id: id,
      prefer_translate_tab: true,
      status: "running",
    });
  }

// Change title in detail popup/tags/reading status: PATCH Post-optimistic write grid/details, then background silent soft alignment.
  async function updateLibraryDocument(
    documentId?: string | null,
    payload: UpdateDocumentPayload = {},
  ): Promise<unknown> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return null;
    }
    const updated = await patchDocument(API_PREFIX, normalizedId, payload) as Record<string, unknown> | null;
    const patch: Partial<LibraryCardItem> = {
      ...(payload.title !== undefined
        ? {
          title: `${updated?.title ?? payload.title ?? ""}`,
          display_name: `${updated?.title ?? payload.title ?? ""}`,
        }
        : {}),
      ...(payload.reading_status !== undefined
        ? { reading_status: `${updated?.reading_status ?? payload.reading_status ?? ""}` }
        : {}),
      ...(payload.tags !== undefined
        ? { tags: (Array.isArray(updated?.tags) ? updated.tags : payload.tags) as string[] }
        : {}),
    };
    if (Object.keys(patch).length) {
      patchLibraryDocumentItem?.(normalizedId, patch);
      const dialogState = bookDetailStore.getState();
      const base = dialogState.payload;
      if (dialogState.open && base && `${base.document_id || ""}`.trim() === normalizedId) {
        bookDetailStore.open({ ...base, ...patch });
      }
    }
    void reload({ reset: true, silent: true });
    return updated;
  }

  return {
    bookDetailStore,
    // Key name alignment services.library.actions existing contract(Consumer RecentJobsLibrary /
    // BookDetailDialog / CategoriesView No need to change)。
    openSourceReader,
    storeOnly: storeUploadedDocumentOnly,
    translateDocument: translateLibraryDocument,
    deleteDocument: deleteLibraryDocument,
    deleteDocuments: deleteLibraryDocuments,
    deleteCard,
    openBookDetail,
    selectJobForDetail,
    updateDocument: updateLibraryDocument,
    /** In-detail progress: silent polling, does not pop up #translation-workflow-dialog */
    attachJobProgress,
  };
}
