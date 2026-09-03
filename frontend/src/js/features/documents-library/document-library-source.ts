// Documents center grid data source (plan F2). Returns shape aligned with
// recent-jobs/pagination.js#collectRecentJobsPage
// ({ collected, hasMore, latestInvocationSummary, nextOffset }), so that
// recent-jobs loader.js/commit.js/store engine can consume it unchanged.
//
// One card per document: first fetch one page of /documents, collect active_job_id
// from that page, batch fetch live state from library/books?job_ids=, then merge
// by job_id (shapeDocumentCardItem). Library documents (no active_job_id) use a
// synthetic job_id to pass through the engine.
//
// Search: /documents currently has no server-side text search (only reading_status/tag/collection
// filtering), so query uses **client-side title/filename filtering**; when a query is present,
// fetch a larger batch then filter, and disable further paging. Document-level server-side
// full-text/title search is a backend TODO (see memory f2-document-centric-grid-design).

import { shapeDocumentsWithBooks } from "./shape-documents-with-books.js";

const SEARCH_FETCH_LIMIT = 200;

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

export async function collectDocumentLibraryPage({
  fetchDocumentList,
  fetchLibraryBookList,
  apiPrefix,
  startOffset = 0,
  pageSize,
  existingJobIds = new Set(),
  query = "",
}: any) {
  const trimmedQuery = `${query || ""}`.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const seen = existingJobIds instanceof Set
    ? new Set(existingJobIds)
    : new Set((Array.isArray(existingJobIds) ? existingJobIds : []).map(normalizedJobId).filter(Boolean));

  const limit = searching ? Math.max(pageSize, SEARCH_FETCH_LIMIT) : pageSize;
  const offset = searching ? 0 : startOffset;

  const payload = await fetchDocumentList(apiPrefix, { limit, offset });
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : documents.length;

  // Documents → cards mapping goes through unified orchestration (shapeDocumentsWithBooks);
  // dedupe/search filtering are the data source's own concerns, left below.
  const shaped = await shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });

  const collected = [];
  for (const item of shaped) {
    const key = normalizedJobId(item.job_id);
    if (!key || seen.has(key)) {
      continue;
    }
    if (searching) {
      const haystack = `${item.title || ""} ${item.display_name || ""} ${item.source_file_name || ""}`.toLowerCase();
      if (!haystack.includes(trimmedQuery)) {
        continue;
      }
    }
    seen.add(key);
    collected.push(item);
  }

  const hasMore = searching
    ? false
    : documents.length > 0 && offset + documents.length < total;
  const nextOffset = searching ? startOffset : startOffset + pageSize;

  return {
    collected,
    hasMore,
    latestInvocationSummary: null,
    nextOffset,
  };
}




