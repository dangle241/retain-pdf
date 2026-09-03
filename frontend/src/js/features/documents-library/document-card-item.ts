// Document grid card item shape (as planned in wondrous-baking-donut.md F2).
//
// Design rationale (see memory f2-document-centric-grid-design): library grid becomes "one card
// per document", but reuses the existing features/recent-jobs store/dedupe/polling engine
// keyed by job_id (unchanged). Thus:
// - Translated documents (active_job_id non-empty): card carries the real job_id, and merges
//   live status/stage/progress/cover from library/books → existing polling/progress/cover
//   mechanisms take over unchanged.
// - Library documents (active_job_id null/empty): given a **synthetic job_id namespace**
//   `doc:<document_id>`, so they pass through dedupeRecentJobs / store filtering (which
//   discards empty job_id) intact; the card uses library_only boolean to mark library state
//   (disables side-by-side reader, shows "untranslated", offers translate/read original),
//   and does not parse the synthetic id.

import { flattenStageSnapshot } from "../../job/stage-snapshot-flatten.js";

export const LIBRARY_ONLY_JOB_PREFIX = "doc:";

export function syntheticLibraryJobId(documentId) {
  const normalized = `${documentId || ""}`.trim();
  return normalized ? `${LIBRARY_ONLY_JOB_PREFIX}${normalized}` : "";
}

export function isLibraryOnlyItem(item: any = {}) {
  return item?.library_only === true;
}

function firstUrl(...candidates) {
  for (const candidate of candidates) {
    const url = `${candidate || ""}`.trim();
    if (url) {
      return url;
    }
  }
  return "";
}

/** If book title is job_id / job_id.pdf / Mock…, use the document's real name instead */
function pickCardTitle(bookTitle, document, jobId) {
  const book = `${bookTitle || ""}`.trim();
  const docTitle = `${document?.title || document?.source_filename || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  const bookIsPlaceholder = !book
    || (id && (book === id || book === `${id}.pdf`))
    || /^Mock(\s|重试|-|_)/i.test(book) // "重试" (retry) is intentionally kept as part of the regex pattern
    || /^mock-/i.test(book);
  if (bookIsPlaceholder && docTitle) {
    return docTitle;
  }
  return book || docTitle || id || "";
}

// document + optional library/books projection → one grid card item.
// When book is found (translated), use book's live fields as primary, overlay document identity
// (document_id, reading_status, tags, source_pdf_url); when book is missing, construct a
// collection card from document fields.
export function shapeDocumentCardItem(document: any = {}, book = null) {
  const documentId = `${document.document_id || ""}`.trim();
  const activeJobId = `${document.active_job_id || ""}`.trim();
  const sharedDocFields = {
    document_id: documentId,
    reading_status: document.reading_status || "",
    tags: Array.isArray(document.tags) ? document.tags : [],
    source_pdf_url: document.source_pdf_url || "",
    bytes: document.bytes,
    added_at: document.added_at || "",
    last_opened_at: document.last_opened_at || null,
  };

  if (activeJobId && book && typeof book === "object") {
    // Translated: use library/books live state as primary (consistent with current grid visual),
    // fill in document identity and cover fallback (synthetic book may lack cover_url, fallback
    // to document-level cover).
    const flattened = flattenStageSnapshot(book);
    const jobId = `${flattened.job_id || book.job_id || activeJobId}`.trim();
    return {
      ...flattened,
      ...sharedDocFields,
      job_id: jobId,
      active_job_id: activeJobId,
      library_only: false,
      // cover/page count: book live first, document fallback (consistent with current grid);
      // title: prevent book from using job_id.pdf to override real title
      cover_url: firstUrl(flattened.cover_url, book.cover_url, document.cover_url),
      thumbnail_url: firstUrl(flattened.thumbnail_url, book.thumbnail_url, document.thumbnail_url),
      page_count: document.page_count || flattened.page_count || 0,
      updated_at: flattened.updated_at || document.updated_at || "",
      title: pickCardTitle(flattened.title || book.title, document, jobId),
      display_name: pickCardTitle(
        flattened.display_name || flattened.title || book.display_name || book.title,
        document,
        jobId,
      ),
    };
  }

  if (activeJobId) {
    // Has active_job_id but no library/books projection (rare corner: job just created or cleared).
    // Keep real job_id so polling/side-by-side reader still works, but without finished live state,
    // treat as incomplete (reader disabled).
    return {
      ...sharedDocFields,
      job_id: activeJobId,
      active_job_id: activeJobId,
      library_only: false,
      status: "",
      title: document.title || document.source_filename || "",
      display_name: document.title || document.source_filename || "",
      source_file_name: document.source_filename || "",
      page_count: document.page_count || 0,
      cover_url: firstUrl(document.cover_url),
      thumbnail_url: firstUrl(document.thumbnail_url),
      updated_at: document.updated_at || "",
    };
  }

  // Collection state (not translated): synthetic job_id to pass through job_id-keyed engine; mark library_only.
  return {
    ...sharedDocFields,
    job_id: syntheticLibraryJobId(documentId),
    active_job_id: "",
    library_only: true,
    status: "",
    title: document.title || document.source_filename || "",
    display_name: document.title || document.source_filename || "",
    source_file_name: document.source_filename || "",
    page_count: document.page_count || 0,
    cover_url: firstUrl(document.cover_url),
    thumbnail_url: firstUrl(document.thumbnail_url),
    updated_at: document.updated_at || "",
  };
}
