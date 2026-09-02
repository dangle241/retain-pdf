// Library (Documents) domain action set — extracted from composition.js (refactoring ①).
//
// composition.js is only responsible for new once + wire the return value into services.library.actions.
//
// Dependencies are injected via parameters (do not directly import composition scope things):
// - documentRef / libraryEventPort / reloadRecentJobs / deleteJob / buildTranslateConfig
// - startPolling: job-runtime starts watching a job (composition passes a closure, feature is fetched at call time)
// - hideStatusArea: when silently receiving progress, do not raise the main page workflow status area
//
// Progress attachment contract (deliberately diverged from selectJob):
// - selectJob (recent-jobs/actions) → open workflow dialog + startPolling
// - attachJobProgress (books controller) → only startPolling, no dialog, no main status area highlight
//   for Book Details "Translation" tab embedded StatusCard usage.

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

  // F4 Library documents "Read Source": no job, dispatch openReaderRequested with documentId,
  // ReaderDialog opens a read-only source document reader using document_id (same event contract as the card side-by-side reader).
  function openSourceReader(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    dispatchAppEvent(APP_EVENTS.openReaderRequested, { documentId: normalizedId, pageIdx: null, blockId: "" });
  }

  // F3 "Added only, no translation": the backend already created the document at the moment upload completed
  // (POST /uploads → upsert_document_from_upload, document_id = content hash),
  // so "added only" does not require any new interface — just **do not submit a translation job**: close the workflow dialog
  // (its close() also resets upload session + scheduleRefresh soft in bindings).
  // No longer force extra refresh, to avoid flashing twice when closing the dialog.
  function storeUploadedDocumentOnly() {
    dispatchAppEvent(APP_EVENTS.closeTranslationWorkflow);
  }

  // Friendly copy for translation failure: the most common backend failure is "OCR/translation credentials not configured"
  // (e.g., paddle_token is required), which is meaningless to users, so give an actionable hint;
  // for other errors, at least surface the backend message (no longer silently swallow).
  function friendlyTranslateError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const credentialish = /(token|key|credentials|token|key|credential)/i.test(message);
    const missing = /(required|required|not configured|not configured|missing)/i.test(message);
    if (credentialish && missing) {
      return "Translation required. Configure OCR and translation credentials in Settings first.";
    }
    return message || "Failed to start translation. Please retry later.";
  }

  // F5 Library documents "Translate later": reuse the document's existing upload to start a book translation job,
  // backend backfills active_job_id; then reload the whole page once — the document will re-enter the grid with a real job_id,
  // and the existing polling engine (active-refresh pulls job payload by job_id) naturally takes over progress.
  //
  // On failure **throw to the caller** (Book Details dialog shows setError inside the dialog + does not close the dialog).
  // Earlier this rendered error into the grid, but the translation entry has moved from the card into the dialog,
  // and grid error entries only display when the "grid is empty"; when the grid is full users see nothing at all —
  // appearing as "clicked but nothing happened" (the real bug when OCR credentials are missing).
  // Assemble the actual job config sent to the backend: first build the full ocr (PaddleOCR) +
  // translation (DeepSeek) base from configured credentials (buildTranslateConfig), then overlay the page scope
  // from the dialog (payload.ocr.page_ranges / payload.translation.start_page–end_page).
  // Without credentials the backend receives no provider and falls back to a deprecated OCR provider, causing failure.
  function assembleTranslatePayload(overrides: TranslateDocumentPayload = {}): TranslateDocumentPayload {
    const pageRanges = `${overrides?.ocr?.page_ranges || ""}`.trim();
    const base = (buildTranslateConfig?.(pageRanges) || {}) as TranslateDocumentPayload;
    return {
      ...(base.ocr ? { ocr: { ...base.ocr, ...(overrides.ocr || {}) } } : (overrides.ocr ? { ocr: overrides.ocr } : {})),
      ...(base.translation ? { translation: { ...base.translation, ...(overrides.translation || {}) } } : (overrides.translation ? { translation: overrides.translation } : {})),
    };
  }

  /**
   * Silently attach job progress (Book Details Translation Tab → bd-job-status-inner).
   * - silent startPolling: only writes statusCardStore, does not raise workflow area, does not broadcast create
   * - never dispatch openTranslationWorkflow (progress main stage is in details, not in dialog)
   * - force hide main status area, to avoid #status-section / main StatusCard stealing focus
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
   * Immediate feedback after translation success (does not wait for full page reload):
   * 1) detail payload immediately gets real job_id → Translation tab switches to StatusCard
   * 2) attachJobProgress → progress ring / stage flow starts immediately
   * 3) publishJobUpdated updates the original card in place by document_id (prevent inserting a second card)
   * 4) background silent refresh aligns with server, no loading flash
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

    // Use JobUpdated: update the original card in place by document_id, prevent main page from inserting another new book
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

    // Immediately attach progress + update details/grid; no longer full page reload (running state is advanced by per-card patch)
    promoteDocumentToJob(normalizedId, result);
    return result;
  }

  // Document-level delete (after backend added DELETE /documents/:id): delete document + all its
  // jobs/uploads/files. Library documents and translated documents both go through this path (cards all carry document_id).
  function friendlyDocumentDeleteError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const status = typeof error === "object" && error ? error.status : undefined;
    if (status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
        ? `This document has ${count} entriesFavorite, delete its favorites before deleting the document.`
        : "This document has favorite references. Delete related favorites before deleting the document.";
    }
    return message || "DeleteDocumentsFailed";
  }

  // Same as translation: throw to caller on failure (display inside dialog). On success optimistically delete card + silent soft reload,
  // no longer await non-silent full page loading (one of the root causes of main page flashing empty).
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

  // Batch delete: API still deletes one by one; grid optimistically removes once + single silent soft reload.
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

  // Card delete entry: if there is document_id, go document-level delete (delete whole document + all its jobs);
  // if not (rare runtime inserted job items), fall back to old job delete, preserving original behavior.
  function deleteCard(target: DeleteCardTarget = {}) {
    const documentId = `${target?.documentId || ""}`.trim();
    if (documentId) {
      // fire-and-forget: deleteLibraryDocument now throws, swallow to avoid unhandled rejection
      // (this card-level entry currently has no consumer; card delete has been merged into the detail dialog).
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
    // Has real job and not a library synthetic id → default to Translation tab progress
    if (jobId && !jobId.startsWith("doc:") && !item?.library_only) {
      return true;
    }
    return false;
  }

  // Book Details dialog: open by clicking card. Running/failed defaults to Translation tab + silent progress,
  // never open #translation-workflow-dialog.
  function openBookDetail(item?: LibraryCardItem | null) {
    if (!item) return;
    const documentId = `${item.document_id || ""}`.trim();
    const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
    // Must have at least document_id or real job_id
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
   * Grid "select job": always go to detail Translation tab + silent progress.
   * No longer fallback to openTranslationWorkflow (old dialog is only reserved for bottom "add").
   */
  function selectJobForDetail(
    jobId?: string | null,
    options: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      /** @deprecated LibraryGrid no longer pops workflow dialog; kept for parameter compatibility / test injection */
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
    // Temporarily can't find the row in grid: still open detail shell with job_id + silent polling, no old dialog
    openBookDetail({
      job_id: id,
      prefer_translate_tab: true,
      status: "running",
    });
  }

  // Detail dialog edit Title/Tags/Reading status: after PATCH, optimistically write grid/details, then background silent soft alignment.
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
    // Key names align with the existing contract of services.library.actions (consumers RecentJobsLibrary /
    // BookDetailDialog / CategoriesView do not need changes).
    openSourceReader,
    storeOnly: storeUploadedDocumentOnly,
    translateDocument: translateLibraryDocument,
    deleteDocument: deleteLibraryDocument,
    deleteDocuments: deleteLibraryDocuments,
    deleteCard,
    openBookDetail,
    selectJobForDetail,
    updateDocument: updateLibraryDocument,
    /** Detail embedded progress: silent polling, no #translation-workflow-dialog popup */
    attachJobProgress,
  };
}





