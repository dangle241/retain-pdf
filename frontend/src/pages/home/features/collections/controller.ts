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

// Category(Collection) Domain's unique assembly face. This is a pure React newly created domain in Era, no old world
// controller.js Reusable,Skip other domain logic. mountXFeature()/viewPort Shell——
// Directly bind one layer. apiPrefix Thin function collection,composition.js Create instance once,
// CategoriesView.jsx/CollectionManageDialog.jsx via services.collections.controller
// Consumption.

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

// Checklist for management popup: All Documents(document Shape, including title), sufficient, not needed.
    // job Card visual fields.
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

// Current folder members document_id set(Used when opening existing category in management modal
    // Initial checked state)。
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // Expand folder/Cover preview data source:collection_id → all documents in the collection → Each article
    // create a card item(and library homepage document-library-source.js Same set
    // shapeDocumentCardItem)。
    //
    // Follows the same logic as the library main grid(document-library-source.js)Identical set. documents →
// cards orchestration(shapeDocumentsWithBooks): Overlay translated documents library/books live,
// Library(untranslated) Generate collection card from document, return all. Formerly divergent old copy, only keep
// Keep translated documents â collections full of library items show "Empty Collection"(mismatch with document_count
    // bug),Converge to unified orchestration; no further divergence.
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });
    },
  };
}
