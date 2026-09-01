// LibraryGrid的"瞬态View信号" store(蓝图 §2 features/library/).
//
// 背景(实测核实,非直觉设计):recentJobsStatePort 的 batch() 提交(初次mpages/
// load-more mpages)与 storeDrivenRendering:true 的组合,导致旧 viewPort 契约的
// renderList/renderEmpty(大多数路径)从不会被引擎实际调用——引擎把Rendering权已经
// 交给 store books身.books store 因此只承担两类事情:
// 1. 引擎仍然"Noneentries件"调用的信号:renderLoading()/setLoadMoreLoading()(loader.js
//    reset/load-more 两branch开头都会调,不受 storeDrivenRendering 影响);
// 2. actions.js 里"直接"调用, 不经 storeDrivenRendering 闸门的边缘路径:
//    - deleteJob 成功且清空 → renderEmpty("No recent jobs yet")
//    - deleteJob Failed / selectJob·openJobReader 缺 job_id → renderError(msg,{reset:false})
//      (镜像旧 applyRecentJobsErrorState:reset:false 时只隐藏 load-more 按钮,
//      不展示错误文案——错误提示走别处的 error-box,这里不越权Rendering)
//
// RecentJobsLibrary.jsx 的最终展示模式**不yes**直接读 store.mode,而yes
// "items.length > 0 优先"的派生逻辑(见组件),因为 store.mode 在Batch提交路径下
// 会停留在陈旧值(例如首次成功加载后 mode 仍yes "loading").books store 只在
// items 为空时才被信任为准确Sources.

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




