// Luồng duy nhất cho "một batch tài liệu → một batch mục thẻ lưới" (tái cấu trúc ②).
//
// Trước đây luồng "thu thập tài liệu có active_job_id → lấy hàng loạt trạng thái library/books → tạo
// bookMap → shapeDocumentCardItem cho từng tài liệu" bị sao chép hai lần: lưới thư viện chính
// (document-library-source.js) và phần mở rộng bộ sưu tập (collections/controller.js). Hai bản
// phân kỳ là nguồn gốc lỗi "bộ sưu tập trống"; bản của bộ sưu tập là bản cũ trước F2 tài liệu trung tâm và tự
// lọc mất tài liệu thư viện. Sau khi gom vào một hàm, mọi giao diện "liệt kê một batch tài liệu thành thẻ"
// (thư viện/bộ sưu tập/tìm kiếm/entry mới tương lai) đều đi qua đây và không còn phân kỳ riêng.
//
// Chỉ phụ trách ánh xạ documents → cards (giữ thứ tự, không loại trùng/phân trang/lọc tìm kiếm; đó là
// mối quan tâm riêng của từng bên dùng và được giữ ở bên gọi).

import { shapeDocumentCardItem } from "./document-card-item.js";

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

// documents: mảng tài liệu trả về từ /documents
// fetchLibraryBookList: cổng (apiPrefix, { jobIds, limit }: any) => { items } (có thể bỏ qua)
// Trả về: mảng mục thẻ cùng độ dài và thứ tự với documents (tài liệu đã dịch được bổ sung trạng thái book; tài liệu thư viện dùng
// job_id tổng hợp).
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
