import {
  addDocumentsToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  patchCollection,
  removeDocumentFromCollection,
  fetchDocumentList,
  fetchLibraryBookList,
  shapeDocumentsWithBooks,
} from "../../composition/external.js";

// Category (Collection) domain's sole assembly surface. This is a pure React-era new
// domain with no old-world controller.js to reuse, so it doesn't follow the other domains'
// mountXFeature()/viewPort pattern — it's a thin function set bound with apiPrefix
// directly, instantiated once in composition.js, consumed by
// CategoriesView.jsx/CollectionManageDialog.jsx via services.collections.controller.

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

    // Manage dialog's selection list: all documents (document shape, includes title), enough
    // — no need for job card visual fields.
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

    // Current folder's member document_id set (used to pre-check initial status when
    // Manage dialog opens an existing category).
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // Folder expansion / cover preview data source: collection_id → all documents in that
    // collection → each document creates a card item (same as Library main page
    // document-library-source.js's shapeDocumentCardItem).
    //
    // Uses the exact same documents → cards arrangement as Library main Grid
    // (document-library-source.js) (shapeDocumentsWithBooks): translated documents layer
    // over library/books live state, library (not translated) documents create library
    // cards, all returned. There was once a divergent old copy here that only preserved
    // translated documents → full library collection display "Empty collection" (bug where
    // document_count didn't match), consolidated into the unified arrangement so it won't
    // diverge again.
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });
    },
  };
}




