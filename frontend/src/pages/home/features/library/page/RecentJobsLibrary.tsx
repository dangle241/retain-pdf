// LibraryGrid root component (Blueprint §2 features/library/).
//
// Subscription design (Blueprint §3): Library book body uses no-selector full snapshot subscription——
// re-rendering grid function is cheap; real performance isolation relies on BookCard's memo +
// cardSignatureOf (see BookCard.jsx), not per-card store subscription (zero gain; Blueprint verified).
//
// Display mode derivation (verified with engine testing; non-intuitive design——see library-view-store.js
// top comment): recentJobsStatePort batch() page submission under storeDrivenRendering:true
// never triggers viewPort.renderList/renderEmpty, so "items.length > 0 first" is the
// only signal source that never becomes stale; libraryViewStore mode is trustworthy only when
// items is empty (loading/empty/error three states driven by renderLoading()/actions.js edge paths).

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

// Client-side sort (only sorts loaded pages; /documents has no sort param; sorted on frontend like reference items).
function sortItems(items, sortMode) {
  const arr = [...items];
  const desc = (key) => (a, b) => `${b?.[key] || ""}`.localeCompare(`${a?.[key] || ""}`);
  switch (sortMode) {
    case "created": return arr.sort(desc("added_at"));
    case "opened": return arr.sort(desc("last_opened_at"));
    case "title":
      return arr.sort((a, b) => `${a?.title || a?.display_name || ""}`.localeCompare(`${b?.title || b?.display_name || ""}`, "en-US"));
    case "updated":
    default:
      return arr.sort(desc("updated_at"));
  }
}

const VIEW_TEXT = Object.freeze({
  loadMore: "More",
  loadMoreLoading: "Loading...",
  empty: "No recent jobs yet",
  emptySearch: "No matching books",
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

  // BatchSelect (#31): selected state uses document_id as key (consistent with Grid primary key);
  // batch mode toggle reported to HomeApp via onBatchModeChange; HomeApp hides the bottom bar
  // (AppBottomBar) with CSS (batchMode yields to this BatchTools bar——both fixed at bottom center).
  const [batchMode, setBatchModeState] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [batchBusy, setBatchBusy] = useState(false);
  const [collections, setCollections] = useState([]);

  function setBatchMode(next) {
    setBatchModeState(next);
    if (!next) setSelectedIds(new Set());
    onBatchModeChange?.(next);
  }
  // useCallback: stable reference——passed to each card as onToggleSelect; otherwise
  // areCardPropsEqual's onToggleSelect is judged unequal every render,
  // RecentJobsLibrary re-rendering drags all cards to re-render together (memo wasted).
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

  // TagsList + per-status counts (for Filter panel display, based on loaded items).
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
    return { tags: [...tagSet].sort((a: string, b: string) => a.localeCompare(b, "en-US")), statusCounts: counts };
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = (statusFilter === "all" && !tagFilter)
      ? items
      : items.filter((item) => matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly: isLibraryOnlyItem, isActive: isRecentJobActive }));
    return sortItems(filtered, sortMode);
  }, [items, statusFilter, tagFilter, sortMode]);

  // BatchSelect only applies to "selectable" items (those with document_id); rare runtime-inserted
  // job-only items (no document_id) cannot be selected and are not included in "Select all loaded" count.
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
    if (!window.confirm(`Delete the selected ${ids.length} documents? This cannot be undone.`)) return;
    setBatchBusy(true);
    try {
      const { confirmed, failed } = await actions.deleteDocuments(ids);
      if (failed === 0) toast.success(`Deleted ${confirmed} documents`);
      else if (confirmed > 0) toast.warning(`Deleted ${confirmed} documents, ${failed} documentsFailed`);
      else toast.error("Delete failed. Please try again later.");
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Delete failed. Please try again later.");
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
      toast.success(`Added to collection, total ${ids.length} documents`);
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Add to collection failed. Please try again later.");
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

  // Returning from Reader: resume #recent-jobs-scroll-body scroll only after List has height
  useHomeReturnRestore(hasItems || mode === "empty" || mode === "error");

  function handleLoadMoreClick() {
    viewPort.handlersRef.current.onLoadMore?.();
  }

  return (
    <section id="library-view" className="library-view" aria-label="Library">
      <div id="recent-jobs-scroll-body" className="library-scroll-body" ref={scrollBodyRef}>
        <div id="recent-jobs-summary" className="status-panel-note library-summary">{summary.text}</div>
        <div id="recent-jobs-empty" className={mode === "list" ? "hidden" : undefined}>
          {mode === "loading" ? (
            <div className="events-empty">Loading recent jobs...</div>
          ) : mode === "error" ? (
            <div className="events-empty">{errorMessage}</div>
          ) : (
            <EmptyState
              instrument="microscope"
              title={emptyMessage || "No recent jobs yet"}
              hint="Uploaded PDFs appear here and can be read after processing is done."
            >
              <button
                type="button"
                className="app-button empty-state-action"
                onClick={() => services.workflowDialog.requestOpenUpload()}
              >
                Upload PDF
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
                  // Shell + buttons: default only "Quick Read"; add Translation etc. by concatenating here
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

// The search input using handleSearchChange stays in LibraryBottomBar (HomeApp.jsx)
// skeleton——LibraryGrid and bottom search bar are siblings, not parent-child (mirrors
// partials/main-content.html). Export this hook for HomeApp.jsx to reuse the same
// onSearch/query channel; avoids two parallel implementations.
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





