// LibraryGrid "transient view signal" store (blueprint §2 features/library/).
//
// Background (verified by testing, not intuitive design): the combination of recentJobsStatePort's batch() submission
// (initial load / load-more load) and storeDrivenRendering:true causes the old viewPort contract's
// renderList/renderEmpty (most paths) to never actually be called by the engine — the engine has already
// handed rendering authority to the store itself. This store therefore only handles two types of things:
// 1. Signals the engine still calls "no conditions": renderLoading()/setLoadMoreLoading() (loader.js
//    reset/load-more both start with these calls, unaffected by storeDrivenRendering);
// 2. "Direct" calls in actions.js, edge paths that don't go through the storeDrivenRendering gate:
//    - deleteJob succeeds and clears → renderEmpty("No recent jobs yet")
//    - deleteJob failed / selectJob·openJobReader missing job_id → renderError(msg,{reset:false})
//      (mirrors old applyRecentJobsErrorState: reset:false only hides load-more button,
//      does not show error copy — error display goes through error-box elsewhere, no overstepping rendering here)
//
// RecentJobsLibrary.jsx's final display mode **does not** read store.mode directly, but rather uses
// "items.length > 0 priority" derived logic (see component), because store.mode in the batch submission path
// stays at stale values (e.g. after first successful load, mode is still "loading"). This store is only
// trusted as an accurate source when items is empty.

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




