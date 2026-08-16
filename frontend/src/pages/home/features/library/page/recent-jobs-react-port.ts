// Hợp đồng viewPort của engine recent-jobs → triển khai React (bản thiết kế §2 features/library/).
//
// Quy tắc cứng: không sửa một dòng của engine poll/patch/throttle (controller/runtime/loader/commit/bindings…);
// tại đây chỉ đáp ứng 10 phương thức trong view-port.js, đổi tác dụng phụ từ "thao tác DOM" sang
// "ghi libraryViewStore". renderList cố ý bỏ tham số items; thành phần React đăng ký trực tiếp
// recentJobsStatePort.store để đọc danh sách; tại đây chỉ chuyển hasMore cho khả năng hiển thị
// nút load-more.
//
// hasView() luôn true: loader.js dùng nó để bỏ tải khi host không tồn tại; view thư viện React
// luôn được gắn. replaceCard() luôn true: engine với storeDrivenRendering
// không thật sự phụ thuộc giá trị trả về để rẽ nhánh kết xuất; thẻ React kết xuất lại theo so sánh chữ ký memo
// (xem RecentJobCard.jsx); trả true chỉ đáp ứng ngữ nghĩa "không thất bại" của bên gọi.

import { createLibraryViewStore } from "./library-view-store.js";
import type {
  AutoLoadCheckOptions,
  LibraryViewStore,
  RecentJobsReactViewPort,
  RecentJobsReactViewPortOptions,
  RecentJobsViewPortHandlers,
} from "../types.js";

export function createRecentJobsReactViewPort({
  store = createLibraryViewStore(),
}: RecentJobsReactViewPortOptions = {}): RecentJobsReactViewPort {
  const viewStore: LibraryViewStore = store;
  const handlersRef: { current: RecentJobsViewPortHandlers } = {
    current: { onOpen: null, onLoadMore: null, onSearch: null, isSuspended: () => false },
  };
  const autoLoadCheckerRef: {
    current: null | ((options?: AutoLoadCheckOptions) => void);
  } = { current: null };

  function hasView() {
    return true;
  }

  function renderLoading() {
    viewStore.actions.setLoading();
  }

  function renderEmpty(message?: string) {
    viewStore.actions.setEmpty(message);
  }

  function renderError(message?: string, { reset = false }: { reset?: boolean } = {}) {
    if (reset) {
      viewStore.actions.setErrorReset(message);
      return;
    }
    // Phản chiếu nhánh reset:false của applyRecentJobsErrorState cũ: chỉ xóa trạng thái loading của load-more,
    // không hiển thị lỗi; lỗi đi qua kênh error-box, không kết xuất vượt quyền tại đây.
    viewStore.actions.clearLoadMoreLoading();
  }

  function renderList({ hasMore = false }: { hasMore?: boolean } = {}) {
    viewStore.actions.setList(hasMore);
  }

  function replaceCard() {
    return true;
  }

  function setLoadMoreLoading() {
    viewStore.actions.setLoadMoreLoading();
  }

  function setDialogOpen() {
    // Dạng phần tử recent-jobs-dialog không bật trong view chính (bản thiết kế §2); giữ phương thức hợp đồng là
    // no-op để luồng gọi cũ trong engine không ném lỗi.
  }

  function scheduleAutoLoadCheck(options?: AutoLoadCheckOptions) {
    autoLoadCheckerRef.current?.(options);
  }

  // Phương thức ngoài hợp đồng: useLibraryAutoLoad dùng nó nối hàm kiểm tra hình học vào
  // chuỗi gọi scheduleAutoLoadCheck, được refresh-scheduler.js gọi sau mỗi commit phân trang.
  function registerAutoLoadChecker(
    checker: ((options?: AutoLoadCheckOptions) => void) | null | undefined,
  ) {
    autoLoadCheckerRef.current = typeof checker === "function" ? checker : null;
    return () => {
      if (autoLoadCheckerRef.current === checker) {
        autoLoadCheckerRef.current = null;
      }
    };
  }

  function bindEvents({
    onOpen,
    onLoadMore,
    onSearch,
    isSuspended = () => false,
  }: Partial<RecentJobsViewPortHandlers> = {}) {
    handlersRef.current = { onOpen, onLoadMore, onSearch, isSuspended };
  }

  return {
    store: viewStore,
    handlersRef,
    bindEvents,
    hasView,
    registerAutoLoadChecker,
    renderEmpty,
    renderError,
    renderList,
    renderLoading,
    replaceCard,
    scheduleAutoLoadCheck,
    setDialogOpen,
    setLoadMoreLoading,
  };
}
