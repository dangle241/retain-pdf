// The single orchestration to turn a batch of Documents into a batch of grid card items (refactor ②).
//
// Previously, this orchestration "collect documents with active_job_id → batch fetch library/books
// live state → build bookMap → shapeDocumentCardItem per document" was duplicated in two places:
// the Library main grid (document-library-source.js) and Collection expansion
// (collections/controller.js). The divergence caused the "Empty collection" bug — the Collection
// copy was an older pre-F2 document-centric code that filtered out library documents.
// By consolidating into this one function, any interface that lists a batch of documents as cards
// (Library/Collection/search/future entry points) goes through it, preventing future divergence.
//
// Only responsible for documents → cards mapping (preserves order, no dedupe/paging/search filtering
// — those are the concerns of each consumer, left to the caller).

import { shapeDocumentCardItem } from "./document-card-item.js";

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

// documents: array from /documents
// fetchLibraryBookList: (apiPrefix, { jobIds, limit }: any) => { items } port (optional)
// Returns: same-length, same-order card items (Translated overlays live book state; Library uses a synthetic job_id).
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




