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

// 分类(合集)域的唯一装配面。这是一个纯 React 时代新建的域,没有旧世界
// controller.js 可复用,所以不套其余域那套 mountXFeature()/viewPort 壳子——
// 直接是一层绑好 apiPrefix 的薄函数集合,composition.js 建一次实例,
// CategoriesView.jsx/CollectionManageDialog.jsx 经 services.collections.controller
// 消费。

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

    // 管理弹窗的勾选清单:全部文档(document 形状,含 title),够用不需要
    // job 卡片的视觉字段。
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

    // 某个文件夹当前的成员 document_id 集合(管理弹窗打开已有分类时用来
    // 勾选初始状态)。
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // 文件夹展开/封面预览的数据源:collection_id → 该合集全部文档 → 每篇都
    // 造一张卡片 item(和图书馆主页 document-library-source.js 同一套
    // shapeDocumentCardItem)。
    //
    // 走和图书馆主网格(document-library-source.js)完全同一套 documents →
    // cards 编排(shapeDocumentsWithBooks):已翻译文档叠加 library/books 活态,
    // 馆藏(未翻译)文档造馆藏卡,全部返回。曾经这里是一份发散的旧拷贝、只保
    // 留已翻译文档 → 满是馆藏的合集显示"空合集"(和 document_count 对不上的
    // bug),收口到统一编排后不会再发散。
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });
    },
  };
}
