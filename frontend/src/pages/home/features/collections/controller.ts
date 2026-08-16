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

// Bề mặt lắp ráp duy nhất của miền phân loại/bộ sưu tập. Đây là miền mới thuần React, không có
// controller.js cũ để dùng lại nên không bọc bằng vỏ mountXFeature()/viewPort như các miền khác;
// chỉ là tập hàm mỏng đã bind apiPrefix, được composition.js tạo một instance,
// CategoriesView.jsx/CollectionManageDialog.jsx sử dụng qua services.collections.controller.
// Sử dụng tại đây.

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

    // Danh sách chọn trong hộp thoại quản lý: toàn bộ tài liệu ở dạng document có title, đủ dùng và không cần
    // các trường hình ảnh của thẻ job.
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

    // Tập document_id thành viên hiện tại của một thư mục, dùng khi hộp thoại quản lý mở phân loại có sẵn để
    // đánh dấu trạng thái ban đầu.
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // Nguồn dữ liệu mở thư mục/xem bìa: collection_id → mọi tài liệu trong bộ sưu tập → mỗi tài liệu
    // tạo một mục thẻ, cùng luồng với document-library-source.js của trang chính thư viện.
    // shapeDocumentCardItem)。
    //
    // Dùng đúng cùng luồng documents → cards với lưới thư viện chính (document-library-source.js):
    // điều phối shapeDocumentsWithBooks; tài liệu đã dịch bổ sung trạng thái sống library/books,
    // tài liệu thư viện chưa dịch tạo thẻ thư viện và đều được trả về. Trước đây bản sao cũ phân kỳ tại đây chỉ giữ
    // tài liệu đã dịch, khiến bộ sưu tập toàn tài liệu thư viện hiển thị "Bộ sưu tập trống" và lệch document_count;
    // sau khi gom về luồng chung sẽ không phân kỳ nữa.
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });
    },
  };
}
