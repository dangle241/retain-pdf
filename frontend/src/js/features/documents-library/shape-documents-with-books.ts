// "A batch of documents → A batch of grid cards item"Sole orchestration(Refactor.②)。
//
// Previous set"Collected active_job_id documentation → Batch fetch library/books Active state → build
// bookMap → one by one shapeDocumentCardItem"Orchestrator duplicated twice.:Library main grid
// (document-library-source.js)Expand collection.(collections/controller.js)Two copies
// Divergence is"Empty collection" bug root cause——Collection file is F2 Old copy before doc centralization,Self
// filter Drop collection doc. After harvest this function,Any"Render doc list as cards."UI
// (Library/collection/search/future new entry point) pass through it; no further divergence.
//
// Only responsible for documents → cards mapping (preserve order, no dedup/no pagination/no search filtering — those are
// Consumer-specific concerns,Keep in caller)。

import { shapeDocumentCardItem } from "./document-card-item.js";

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

// documents: /documents returned document array
// fetchLibraryBookList: (apiPrefix, { jobIds, limit }: any) => { items } port (optional)
// Returns: cards item array of same length and order as documents (translation overlaid book live state, holdings via
// synthetic job_id).
export async function shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix }: any = {}) {
  const docs = Array.isArray(documents) ? documents : [];
  const jobIds = docs.map((doc) => normalizedJobId(doc?.active_job_id)).filter(Boolean);

  const bookMap = new Map();
  if (jobIds.length && typeof fetchLibraryBookList === "function") {
    const payload = await fetchLibraryBookList(apiPrefix, { jobIds, limit: jobIds.length });
    for (const book of (Array.isArray(payload?.items) ? payload.items : [])) {
      const id = normalizedJobId(book?.job_id);
      if (id) {
        bookMap.set(id, book);
      }
    }
  }

  return docs.map((doc) => {
    const activeJobId = normalizedJobId(doc?.active_job_id);
    return shapeDocumentCardItem(doc, activeJobId ? bookMap.get(activeJobId) || null : null);
  });
}
