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

// Category(Collection)域的唯一装配面.这yes一个纯 React 时代新建的域,没有旧世界
// controller.js 可复用,所以不套其余域那套 mountXFeature()/viewPort 壳子——
// 直接yes一层绑好 apiPrefix 的薄函数集合,composition.js 建一次实例,
// CategoriesView.jsx/CollectionManageDialog.jsx 经 services.collections.controller
// 消费.

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

    // Manage弹窗的勾选清单:AllDocuments(document 形状,含 title),够用不required
    // job 卡片的视觉字段.
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

    // 某个Files夹Current的成员 document_id 集合(Manage弹窗打开已有Category时用来
    // 勾选初始Status).
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // Files夹展开/封面预览的Data源:collection_id → 该CollectionAllDocuments → 每documents都
    // 造一张卡片 item(和Library主pages document-library-source.js 同一套
    // shapeDocumentCardItem).
    //
    // 走和Library主Grid(document-library-source.js)完全同一套 documents →
    // cards 编排(shapeDocumentsWithBooks):TranslatedDocuments叠加 library/books 活态,
    // Library(Not translated)Documents造Library卡,All返回.曾经这里yes一份发散的旧拷贝, 只保
    // 留TranslatedDocuments → 满yesLibrary的CollectionDisplay"Empty collection"(和 document_count 对不上的
    // bug),收口到统一编排后不会再发散.
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });
    },
  };
}




