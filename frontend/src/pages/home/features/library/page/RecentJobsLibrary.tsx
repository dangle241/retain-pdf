// Library grid root component (Blueprint Â§2 features/library/).
//
// Subscription design (Blueprint Â§3): Library Main body runs without selector Full snapshot subscription â re-render grid function
// Base unit cheap., True performance isolation relies on BookCard memo + cardSignatureOf (see
// BookCard.jsx), no per-card store Subscription (Zero revenue, Blueprint validated).
//
// Display mode derivation (Verified against engine., Non-intuitive design. â see library-view-store.js Top
// comment): recentJobsStatePort batch() Pagination submit in storeDrivenRendering:true
// Never triggers viewPort.renderList/renderEmpty, so "items.length > 0 priority" is
// Only non-stale signal source; libraryViewStore mode is trusted only when items are empty.
// (loading/empty/error Tri-state from renderLoading()/actions.js Edge path driven)。

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

// Client-side sorting (Sort only loaded pages; /documents has no sort parameter, sort frontend like reference project).
function sortItems(items, sortMode) {
  const arr = [...items];
  const desc = (key) => (a, b) => `${b?.[key] || ""}`.localeCompare(`${a?.[key] || ""}`);
  switch (sortMode) {
    case "created": return arr.sort(desc("added_at"));
    case "opened": return arr.sort(desc("last_opened_at"));
    case "title":
      return arr.sort((a, b) => `${a?.title || a?.display_name || ""}`.localeCompare(`${b?.title || b?.display_name || ""}`, "zh-CN"));
    case "updated":
    default:
      return arr.sort(desc("updated_at"));
  }
}

const VIEW_TEXT = Object.freeze({
  loadMore: "More",
loadMoreLoading: "Loadingâ¦",
empty: "No recent tasks",
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

  // Batch select(#31):For selected state document_id as key(Matches grid primary key.);Batch mode
// Switch state onBatchModeChange Report to HomeApp, Bottom bar rendered by it (AppBottomBar)
// CSS hidden (batchMode Yield to this bulk toolbar during the period. Both fixed bottom-center).
  const [batchMode, setBatchModeState] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [batchBusy, setBatchBusy] = useState(false);
  const [collections, setCollections] = useState([]);

  function setBatchMode(next) {
    setBatchModeState(next);
    if (!next) setSelectedIds(new Set());
    onBatchModeChange?.(next);
  }
// useCallback: stable reference â Pass to each card as onToggleSelect, otherwise
// onToggleSelect in areCardPropsEqual is unequal every render,
  // RecentJobsLibrary Single re-render triggers all cards.(memo Wasted effort)。
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

  // Tag list + State counts(Display in filter panel,Based on loaded items)。
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
    return { tags: [...tagSet].sort((a: string, b: string) => a.localeCompare(b, "zh-CN")), statusCounts: counts };
  }, [items]);

  const visibleItems = useMemo(() => {
    const filtered = (statusFilter === "all" && !tagFilter)
      ? items
      : items.filter((item) => matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly: isLibraryOnlyItem, isActive: isRecentJobActive }));
    return sortItems(filtered, sortMode);
  }, [items, statusFilter, tagFilter, sortMode]);

// Batch selection applies only to "Selectable" items (those with document_id); rare runtime insertions
// job-only items (no document_id) cannot be selected, excluded from count and "Select all loaded" denominator.
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
    if (!window.confirm(`Confirm delete selected ${ids.length} This document? This operation cannot be undone.`)) return;
    setBatchBusy(true);
    try {
      const { confirmed, failed } = await actions.deleteDocuments(ids);
if (failed === 0) toast.success(`Deleted ${confirmed} articles`);
else if (confirmed > 0) toast.warning(`Deleted ${confirmed}, ${failed} failed`);
      else toast.error("Delete failed. Retry later.");
      setBatchMode(false);
    } catch (err) {
toast.error(err?.message || "Deletion failed, please try again later");
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
toast.success(`Added to collection, total ${ids.length} articles`);
      setBatchMode(false);
    } catch (err) {
      toast.error(err?.message || "Failed to add to collection. Retry later.");
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

// Restore after list has height. #recent-jobs-scroll-body scrolling
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
            <div className="events-empty">Loading recent tasks…</div>
          ) : mode === "error" ? (
            <div className="events-empty">{errorMessage}</div>
          ) : (
            <EmptyState
              instrument="microscope"
              title={emptyMessage || "No recent tasks"}
hint="Uploaded PDFs appear here after processing."
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
// Shell + Button: Only "Quick Read"; concat translation etc. here
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

// Use handleSearchChange so search input remains in place. LibraryBottomBar(HomeApp.jsx)
// Skeleton. Library grid and bottom search bar are sibling nodes, not parent-child relationship (mirrors
// partials/main-content.html) Export this hook for HomeApp.jsx to reuse same entry
// onSearch/query channel,Avoid duplicate parallel implementations.
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
