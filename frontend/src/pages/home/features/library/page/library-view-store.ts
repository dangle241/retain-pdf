// Store "tín hiệu view tạm" của lưới thư viện (bản thiết kế §2 features/library/).
//
// Bối cảnh đã kiểm chứng thực tế: commit batch() của recentJobsStatePort (phân trang đầu/
// load-more) kết hợp storeDrivenRendering:true khiến các phương thức renderList/renderEmpty của hợp đồng viewPort cũ
// không bao giờ được engine gọi trên phần lớn luồng; engine đã chuyển quyền kết xuất
// cho chính store. Vì vậy store này chỉ chịu hai loại việc:
// 1. Tín hiệu engine vẫn gọi "vô điều kiện": renderLoading()/setLoadMoreLoading() ở đầu hai nhánh
//    reset/load-more của loader.js, không bị storeDrivenRendering ảnh hưởng;
// 2. Luồng biên được actions.js gọi "trực tiếp", không qua cổng storeDrivenRendering:
//    - deleteJob thành công và danh sách trống → renderEmpty("Chưa có tác vụ gần đây")
//    - deleteJob lỗi / selectJob·openJobReader thiếu job_id → renderError(msg,{reset:false})
//      (phản chiếu applyRecentJobsErrorState cũ: reset:false chỉ ẩn nút load-more,
//      không hiển thị nội dung lỗi; lỗi đi qua error-box nơi khác, không kết xuất vượt quyền tại đây).
//
// Chế độ hiển thị cuối của RecentJobsLibrary.jsx **không** đọc trực tiếp store.mode mà dùng
// logic suy ra "ưu tiên items.length > 0" (xem thành phần), vì store.mode trong luồng commit batch
// có thể giữ giá trị cũ, như mode vẫn là "loading" sau tải thành công đầu tiên. Store này chỉ được
// tin là nguồn chính xác khi items rỗng.

import type {
  LibraryViewActions,
  LibraryViewState,
  LibraryViewStore,
} from "../types.js";
import { createStore } from "../../../composition/external.js";

export function createLibraryViewStore(): LibraryViewStore {
  return createStore<LibraryViewState, LibraryViewActions>({
    name: "libraryView",
    initialState: {
      mode: "loading",
      message: "",
      hasMore: false,
      loadMoreLoading: false,
      query: "",
    },
    actions: {
      setLoading(state) {
        return { ...state, mode: "loading", loadMoreLoading: false };
      },
      setEmpty(state, message = "") {
        return { ...state, mode: "empty", message: `${message || ""}`, loadMoreLoading: false };
      },
      setErrorReset(state, message = "") {
        return { ...state, mode: "error", message: `${message || ""}`, loadMoreLoading: false };
      },
      clearLoadMoreLoading(state) {
        return { ...state, loadMoreLoading: false };
      },
      setList(state, hasMore = false) {
        return { ...state, mode: "list", hasMore: Boolean(hasMore), loadMoreLoading: false };
      },
      setLoadMoreLoading(state) {
        return { ...state, loadMoreLoading: true };
      },
      setQuery(state, query = "") {
        return { ...state, query: `${query || ""}` };
      },
    },
  });
}
