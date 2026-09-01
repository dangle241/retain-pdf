// recent-jobs engine viewPort contract â React implementation (Blueprint Â§2 features/library/).
//
// Iron rule: Polling/Patch/Throttle engine (controller/runtime/loader/commit/bindingsâ¦) No source text provided. Paste Chinese comment to translate.
// Change; Only satisfies this here. view-port.js Defined 10 Method contract, Extract side effects from "Operation DOM" to
// "write libraryViewStore". renderList Intentionally ignored items parameter â React Component subscribes directly
// recentJobsStatePort.store read list content, Only move/copy here. hasMore used for load-more
// Button visibility.
//
// hasView() always true: loader.js Use it. "host Skip load if absent" Short-circuit evaluation, React
// World library view always mounted. replaceCard() always true: Engine at storeDrivenRendering
// No conditional render branch on return value.,React Card now uses memo Signature comparison triggers re-render.
// (see RecentJobCard.jsx), Return true here to satisfy caller only. "Not failed" semantics.

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
// Mirror old applyRecentJobsErrorState reset:false branch: only clear load-more
// Loading state, do not show error text (Error message goes here. error-box channel, No out-of-scope rendering here).
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
// recent-jobs-dialog element form disabled in main view (Blueprint Â§2), Keep as contract method
    // no-op,Prevent any legacy call paths in engine from throwing errors.
  }

  function scheduleAutoLoadCheck(options?: AutoLoadCheckOptions) {
    autoLoadCheckerRef.current?.(options);
  }

  // Non-contract method:useLibraryAutoLoad Hook custom geometry validation via this.
  // scheduleAutoLoadCheck call chain(refresh-scheduler.js Call after each pagination submission.)。
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
