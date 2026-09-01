// Doc center grid card item shape (planned in wondrous-baking-donut.md's F2).
//
// Design points (see memory f2-document-centric-grid-design): library grid changed to "Each document
// Single card", reuse underlying layer. features/recent-jobs provides the source text, job_id keyed. store/dedup/polling
// Engine (no changes.) Thus:
// - Document translated (active_job_id non-empty): card carries real job_id, and merges real-time library/books
//   status/stage/progress/cover merge → existing polling/progress/cover mechanism takes over as-is.
// - Collection documents (active_job_id is null/empty): provide a synthetic namespace job_id
//   `doc:<document_id>`,Allow it to pass through as-is by job_id Deduplicate. dedupeRecentJobs / store,
//   Not "empty job_id directly discarded" filter logic; card leans on library_only boolean branch for collection state.
//   (Disable parallel reading, display "Untranslated" or read original), skip parsing this composition's id.

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

/** book If title is job_id / job_id.pdf / Mock…Use real file names. */
function pickCardTitle(bookTitle, document, jobId) {
  const book = `${bookTitle || ""}`.trim();
  const docTitle = `${document?.title || document?.source_filename || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  const bookIsPlaceholder = !book
    || (id && (book === id || book === `${id}.pdf`))
|| /^Mock(\s|Retry|-|)/i.test(book)
    || /^mock-/i.test(book);
  if (bookIsPlaceholder && docTitle) {
    return docTitle;
  }
  return book || docTitle || id || "";
}

// document + optional library/books projection → a grid card item.
// book hit (translated): book prioritizes live fields, overlay document identity (document_id,
// reading_status、tags、source_pdf_url);book When missing, construct a library card from document fields.
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
// Translated: library/books live state takes precedence (consistent with current grid visuals). Incomplete sentence. Provide full source text for translation.
    // Cover fallback(Synthesize book May not include cover_url,Revert to document level cover)。
    const flattened = flattenStageSnapshot(book);
    const jobId = `${flattened.job_id || book.job_id || activeJobId}`.trim();
    return {
      ...flattened,
      ...sharedDocFields,
      job_id: jobId,
      active_job_id: activeJobId,
      library_only: false,
// Cover/pages: book live-first, doc-level fallback (aligns with current grid visuals);
// Title: prevent book from using job_id.pdf to overwrite real book title.
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
// Has active_job_id but no library/books projection (rare edge case: job just created/cleared). Preserve real
// job_id lets polling/side-by-side reading still work; no live production build; handle as incomplete (reader disabled).
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

// Collection status (untranslated): synthetic job_id passes through job_id-keyed engine; library_only tag.
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
