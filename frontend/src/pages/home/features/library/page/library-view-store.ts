// Library grid's "Transient view signal" store (Blueprint Â§2 features/library/).
//
// Background (Verify via testing, non-intuitive design): recentJobsStatePort batch() commit (Initial pagination/
// load-more pagination) and storeDrivenRendering:true combination, causes legacy viewPort Contractual
// renderList/renderEmpty(Most paths)Never actually invoked by engine.——Engine has already transferred rendering control.
// handed to store itself. This store thus handles only two categories:
// 1. Engine still"Unconditional"call signals:renderLoading()/setLoadMoreLoading()(loader.js
//    reset/load-more Both branches call at start.,Not accepted storeDrivenRendering Impact);
// 2. "Direct" calls in actions.js, bypassing storeDrivenRendering Gate edge path:
//    - deleteJob Success, cleared. → renderEmpty("No recent tasks")
//    - deleteJob failed / selectJobÂ·openJobReader missing job_id â renderError(msg,{reset:false})
//      (Mirrors old applyRecentJobsErrorState:reset:false Hide only during time window. load-more button,
//      Hide error text.——Error message routed elsewhere. error-box,No permission check here. Render bypasses auth.)
//
// RecentJobsLibrary.jsx Final display mode is NOT read directly from store.mode, but
// "items.length > 0 priority" derivation logic (see component), because store.mode in batch commit path
// Stale value persists (e.g. after first successful load mode still is "loading"). store only in
// items Trusted as accurate source only when empty.

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
