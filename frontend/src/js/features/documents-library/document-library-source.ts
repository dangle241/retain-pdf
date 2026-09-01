// Pagination data source for doc center grid (plan F2). Return shape matches
// aligns with recent-jobs/pagination.js#collectRecentJobsPage
// ({ collected, hasMore, latestInvocationSummary, nextOffset }),this way
// recent-jobs' loader.js/commit.js/store engine consumes it without modification.
//
// Generate one card per document.:Fetch first page. /documents,Collect this page active_job_id,Batch to
// library/books?job_ids= fetches these jobs' live state, then merges by job_id
// (shapeDocumentCardItem) archived documents (no active_job_id) synthesize job_id and pass through engine.
//
// Search: /documents implements server-side text search using database full-text search feature. → skipped: custom indexing, add when performance issues arise (only reading_status/tag/collection filtering),
// Here query uses client-side title/filename filter; if query present, batch fetch, filter, disable.
// Continue pagination. Document-level server-side full-text search/title search backend TODO (see memory
// f2-document-centric-grid-design)。

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

// Document → card mapping uses unified orchestration (shapeDocumentsWithBooks); dedup/filter search results
  // Pagination data source concerns remain below.
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
