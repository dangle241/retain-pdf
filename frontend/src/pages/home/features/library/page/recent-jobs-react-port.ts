// recent-jobs engine viewPort contract → React implementation (blueprint §2 features/library/).
//
// Iron rule: polling/patch/throttle engine (controller/runtime/loader/commit/bindings...) not one
// line changed; this only satisfies the 10-method contract defined in view-port.js, replacing side effects from "Action DOM" with
// "write to libraryViewStore". renderList intentionally ignores items parameter — React components subscribe directly to
// recentJobsStatePort.store to read list content, this only carries hasMore for load-more
// button visibility.
//
// hasView() always true: loader.js uses it for "if host doesn't exist, skip loading" short-circuit judgment, in the React
// world LibraryView is always mounted. replaceCard() always true: engine in storeDrivenRendering
// doesn't truly depend on its return value for conditional event rendering branch, React cards driven by memo signature comparison for re-render
// (see RecentJobCard.jsx), returning true here just satisfies the caller "not failed" semantics.

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
    // Mirror old applyRecentJobsErrorState's reset:false branch: only clear load-more
    // loading state, don't show error copy (error display goes through error-box channel, not overstepping rendering here).
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
    // recent-jobs-dialog element form not enabled in main view (blueprint §2), contract method kept as
    // no-op, to prevent any legacy call paths in the engine from throwing errors.
  }

  function scheduleAutoLoadCheck(options?: AutoLoadCheckOptions) {
    autoLoadCheckerRef.current?.(options);
  }

  // Non-contract method: useLibraryAutoLoad uses this to hook its geometry check function into
  // scheduleAutoLoadCheck's call chain (refresh-scheduler.js calls after each page submission).
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




