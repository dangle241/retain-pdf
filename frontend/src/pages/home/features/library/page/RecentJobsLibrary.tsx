// Thành phần gốc lưới thư viện (bản thiết kế §2 features/library/).
//
// Thiết kế đăng ký (bản thiết kế §3): Library đăng ký toàn snapshot không selector; kết xuất lại hàm grid
// rẻ; cách ly hiệu năng thật dựa vào memo + cardSignatureOf của BookCard (xem
// BookCard.jsx), không đăng ký store theo từng thẻ vì không có lợi ích, đã được bản thiết kế xác minh.
//
// Suy ra chế độ hiển thị, đã kiểm chứng với engine và không trực giác; xem chú thích đầu library-view-store.js:
// commit phân trang batch() của recentJobsStatePort với storeDrivenRendering:true
// không bao giờ kích hoạt viewPort.renderList/renderEmpty, nên "ưu tiên items.length > 0" là
// nguồn tín hiệu duy nhất không cũ; mode của libraryViewStore chỉ đáng tin khi items rỗng
// (ba trạng thái loading/empty/error do renderLoading()/luồng biên actions.js điều khiển).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import { useHomeServices } from "../../../home-services-context.js";
import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { BookListRow } from "../shell/BookListRow.jsx";
import { LibraryToolbar } from "./LibraryToolbar.jsx";
import { LibraryFilterMenu, matchesLibraryFilter } from "./LibraryFilterMenu.jsx";
import { LibraryBatchToolbar } from "./LibraryBatchToolbar.jsx";
import { useLibraryAutoLoad } from "./useLibraryAutoLoad.js";
import { useHomeReturnRestore } from "./useHomeReturnRestore.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";
import {
  buildRecentJobsSummaryViewModel,
  HOME_LOADING_STATES,
  isLibraryOnlyItem,
  isRecentJobActive,
} from "../../../composition/external.js";

// Sắp xếp client chỉ trên các trang đã tải; /documents không có tham số sort nên sắp ở frontend như dự án tham khảo.
function sortItems(items, sortMode) {
  const arr = [...items];
  const desc = (key) => (a, b) => `${b?.[key] || ""}`.localeCompare(`${a?.[key] || ""}`);
  switch (sortMode) {
    case "created": return arr.sort(desc("added_at"));
    case "opened": return arr.sort(desc("last_opened_at"));
    case "title":
      return arr.sort((a, b) => `${a?.title || a?.display_name || ""}`.localeCompare(`${b?.title || b?.display_name || ""}`, "vi-VN"));
    case "updated":
    default:
      return arr.sort(desc("updated_at"));
  }
}

const VIEW_TEXT = Object.freeze({
  loadMore: "Thêm",
  loadMoreLoading: "Đang tải…",
  empty: "Chưa có tác vụ gần đây",
  emptySearch: "Không có sách phù hợp",
});

export function RecentJobsLibrary({ onBatchModeChange }: any = {}) {
  const services = useHomeServices();
  const { viewPort, recentJobsStore, actions } = services.library;

  const recentJobs = useStoreSnapshot(recentJobsStore);
  const homeState = useStoreSnapshot(services.stores.homeState);
  const view = useStoreSnapshot(viewPort.store);

  const scrollBodyRef = useRef(null);
  const [viewMode, setViewMode] = useState("grid");
  const [sortMode, setSortMode] = useState("updated");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");

  // Chọn hàng loạt (#31): trạng thái chọn dùng document_id làm key, nhất quán khóa chính lưới; công tắc chế độ hàng loạt
  // báo HomeApp qua onBatchModeChange để HomeApp dùng CSS
  // ẩn AppBottomBar trong batchMode, nhường chỗ cho thanh hàng loạt; cả hai cố định giữa đáy.
  const [batchMode, setBatchModeState] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [batchBusy, setBatchBusy] = useState(false);
  const [collections, setCollections] = useState([]);

  function setBatchMode(next) {
    setBatchModeState(next);
    if (!next) setSelectedIds(new Set());
    onBatchModeChange?.(next);
  }
  // useCallback giữ tham chiếu ổn định khi truyền onToggleSelect cho mỗi thẻ; nếu không
  // onToggleSelect trong areCardPropsEqual bị coi là khác ở mỗi lần render,
  // RecentJobsLibrary kết xuất lại sẽ kéo mọi thẻ cùng kết xuất, làm memo vô ích.
  const toggleSelect = useCallback((documentId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!batchMode) return;
    services.collections?.controller?.listCollections().then((list) => {
      const rows = Array.isArray(list?.collections) ? list.collections : (Array.isArray(list) ? list : []);
      setCollections(rows);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMode]);

  const items = Array.isArray(recentJobs.items) ? recentJobs.items : [];

  // Danh sách nhãn + số lượng từng trạng thái cho bảng lọc, dựa trên mục đã tải.
  const { tags, statusCounts } = useMemo(() => {
    const tagSet = new Set<string>();
    const counts = { done: 0, untranslated: 0, active: 0, failed: 0 };
    for (const item of items) {
      (Array.isArray(item.tags) ? item.tags : []).forEach((t: any) => t && tagSet.add(`${t}`));
      if (isLibraryOnlyItem(item)) { counts.untranslated += 1; continue; }
      const s = `${item.status || ""}`.trim();
      if (isRecentJobActive(item)) counts.active += 1;
      else if (s === "succeeded") counts.done += 1;
      else if (s === "failed") counts.failed += 1;
    }
    return { tags: [...tagSet].sort((a: string, b: string) => a.localeCompare(b, "vi-VN")), statusCounts: counts };
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = (statusFilter === "all" && !tagFilter)
      ? items
      : items.filter((item) => matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly: isLibraryOnlyItem, isActive: isRecentJobActive }));
    return sortItems(filtered, sortMode);
  }, [items, statusFilter, tagFilter, sortMode]);

  // Chọn hàng loạt chỉ tác động mục "có thể chọn" có document_id; mục job-only hiếm được chèn runtime
  // không có document_id nên không chọn được và không tính vào mẫu số "chọn tất cả đã tải".
  const selectableIds = useMemo(
    () => visibleItems.map((item) => `${item.document_id || ""}`.trim()).filter(Boolean),
    [visibleItems],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function handleSelectAllToggle() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    if (!ids.length || batchBusy) return;
    if (!window.confirm(`Xác nhận xóa ${ids.length} tài liệu đã chọn? Thao tác này không thể hoàn tác.`)) return;
    setBatchBusy(true);
    try {
      const { confirmed, failed } = await actions.deleteDocuments(ids);
      if (failed === 0) toast.success(`Đã xóa ${confirmed} tài liệu`);
      else if (confirmed > 0) toast.warning(`Đã xóa ${confirmed} tài liệu, ${failed} tài liệu thất bại`);
      else toast.error("Xóa thất bại, vui lòng thử lại sau");
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Xóa thất bại, vui lòng thử lại sau");
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleBatchAddToCollection(collectionId) {
    const ids = [...selectedIds];
    if (!ids.length || batchBusy) return;
    setBatchBusy(true);
    try {
      await services.collections.controller.addDocuments(collectionId, ids);
      toast.success(`Đã thêm ${ids.length} tài liệu vào bộ sưu tập`);
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Không thể thêm vào bộ sưu tập, vui lòng thử lại sau");
    } finally {
      setBatchBusy(false);
    }
  }

  const hasItems = items.length > 0;
  const isLoading = homeState.recentJobsLoadingState === HOME_LOADING_STATES.LOADING;
  const isErrorState = !hasItems
    && (homeState.recentJobsLoadingState === HOME_LOADING_STATES.ERROR || view.mode === "error");

  const mode = hasItems ? "list" : (isLoading ? "loading" : (isErrorState ? "error" : "empty"));
  const loadMoreLoading = hasItems && isLoading;
  const emptyMessage = view.query.trim() ? VIEW_TEXT.emptySearch : VIEW_TEXT.empty;
  const errorMessage = view.mode === "error" && view.message ? view.message : (homeState.recentJobsError || VIEW_TEXT.empty);

  const summary = buildRecentJobsSummaryViewModel(recentJobs.invocationSummary, items);

  useLibraryAutoLoad({
    scrollBodyRef,
    hasMore: Boolean(recentJobs.hasMore),
    loadMoreLoading,
    viewPort,
  });

  // Khi trở về từ trình đọc: chỉ khôi phục cuộn #recent-jobs-scroll-body sau khi danh sách có chiều cao.
  useHomeReturnRestore(hasItems || mode === "empty" || mode === "error");

  function handleLoadMoreClick() {
    viewPort.handlersRef.current.onLoadMore?.();
  }

  return (
    <section id="library-view" className="library-view" aria-label="Thư viện">
      <div id="recent-jobs-scroll-body" className="library-scroll-body" ref={scrollBodyRef}>
        <div id="recent-jobs-summary" className="status-panel-note library-summary">{summary.text}</div>
        <div id="recent-jobs-empty" className={mode === "list" ? "hidden" : undefined}>
          {mode === "loading" ? (
            <div className="events-empty">Đang tải tác vụ gần đây…</div>
          ) : mode === "error" ? (
            <div className="events-empty">{errorMessage}</div>
          ) : (
            <EmptyState
              instrument="microscope"
              title={emptyMessage || "Chưa có tác vụ gần đây"}
              hint="PDF sẽ xuất hiện tại đây sau khi tải lên và có thể đọc khi xử lý hoàn tất."
            >
              <button
                type="button"
                className="app-button empty-state-action"
                onClick={() => services.workflowDialog.requestOpenUpload()}
              >
                Tải PDF lên
              </button>
            </EmptyState>
          )}
        </div>
        {mode === "list" ? (
          <LibraryToolbar
            count={visibleItems.length}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sortMode={sortMode}
            setSortMode={setSortMode}
            batchMode={batchMode}
            onToggleBatchMode={setBatchMode}
            filterSlot={(
              <LibraryFilterMenu
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                tagFilter={tagFilter}
                setTagFilter={setTagFilter}
                tags={tags}
                statusCounts={statusCounts}
              />
            )}
          />
        ) : null}
        <div id="library-grid" className={viewMode === "list" ? "" : "recent-jobs-list library-grid"}>
          <div
            id="recent-jobs-list"
            className={`${viewMode === "list" ? "flex flex-col gap-1" : "recent-jobs-list library-grid"}${mode === "list" ? "" : " hidden"}`}
          >
            {visibleItems.map((item) => (
              viewMode === "list" ? (
                <BookListRow
                  key={item.job_id}
                  item={item}
                  onSelect={actions.selectJob}
                  onReader={actions.openJobReader}
                  onReadSource={actions.openSourceReader}
                  onOpenDetail={actions.openBookDetail}
                  batchMode={batchMode}
                  selected={selectedIds.has(`${item.document_id || ""}`.trim())}
                  onToggleSelect={toggleSelect}
                />
              ) : (
                <BookCard
                  key={item.job_id}
                  item={item}
                  // Vỏ + nút: mặc định chỉ có "Đọc nhanh"; muốn thêm dịch, v.v. chỉ cần concat tại đây.
                  actions={buildDefaultBookCardActions(item, {
                    onReader: actions.openJobReader,
                    onReadSource: actions.openSourceReader,
                  })}
                  onSelect={actions.selectJob}
                  onOpenDetail={actions.openBookDetail}
                  batchMode={batchMode}
                  selected={selectedIds.has(`${item.document_id || ""}`.trim())}
                  onToggleSelect={toggleSelect}
                />
              )
            ))}
          </div>
        </div>
        <div className="recent-jobs-more-row">
          <button
            id="load-more-jobs-btn"
            className={`secondary${recentJobs.hasMore ? "" : " hidden"}`}
            type="button"
            disabled={loadMoreLoading}
            onClick={handleLoadMoreClick}
          >
            {loadMoreLoading ? VIEW_TEXT.loadMoreLoading : VIEW_TEXT.loadMore}
          </button>
        </div>
      </div>
      {batchMode ? (
        <LibraryBatchToolbar
          count={selectedIds.size}
          totalSelectable={selectableIds.length}
          allSelected={allSelected}
          onSelectAll={handleSelectAllToggle}
          onCancel={() => setBatchMode(false)}
          onDelete={handleBatchDelete}
          collections={collections}
          onAddToCollection={handleBatchAddToCollection}
          busy={batchBusy}
        />
      ) : null}
    </section>
  );
}

// Ô tìm kiếm dùng handleSearchChange nằm trong khung LibraryBottomBar (HomeApp.jsx);
// lưới thư viện và thanh tìm kiếm đáy là anh em cùng cấp, không phải cha con, phản chiếu
// partials/main-content.html. Export hook để HomeApp.jsx dùng lại cùng kênh
// onSearch/query, tránh hai triển khai song song.
export function useLibrarySearchBinding() {
  const services = useHomeServices();
  const { viewPort } = services.library;
  const view = useStoreSnapshot(viewPort.store);

  function onSearchChange(event) {
    const value = event.target.value;
    viewPort.store.actions.setQuery(value);
    viewPort.handlersRef.current.onSearch?.(value);
  }

  return { query: view.query, onSearchChange };
}
