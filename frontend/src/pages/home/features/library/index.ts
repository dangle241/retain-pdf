// library 域对外入口 —— 页面/composition 只从这里 import，勿深挖子路径（测试除外）。
//
// 目录:
//   shell/      通用壳（BookCard、BookListRow）
//   actions/    卡片操作工厂（read / translate）
//   display/    展示辅助（封面、徽标）
//   page/       书架页编排（网格、工具条、viewPort）
//   categories/ 合集 tab
//   favorites/  收藏 tab（摘录/笔记）
//   detail/     书籍详情（shell 壳 + Dialog 容器）
//   domain/     领域 controller

export { BookCard, BookCardActionButton, cardSignatureOf } from "./shell/BookCard.jsx";
export { BookListRow } from "./shell/BookListRow.jsx";
export {
  RecentJobCard,
  getCardRenderCountForTests,
  resetCardRenderCountsForTests,
} from "./shell/RecentJobCard.jsx";

export {
  buildDefaultBookCardActions,
  buildShelfBookCardActions,
  buildReadBookCardAction,
  buildTranslateBookCardAction,
  bookCardActionsSignature,
  BOOK_CARD_ACTION_READ,
  BOOK_CARD_ACTION_TRANSLATE,
} from "./actions/index.js";

export { RecentJobsLibrary, useLibrarySearchBinding } from "./page/RecentJobsLibrary.jsx";
export { createRecentJobsReactViewPort } from "./page/recent-jobs-react-port.js";
export { createLibraryViewStore } from "./page/library-view-store.js";
export { LibraryTopTabs } from "./page/LibraryTopTabs.jsx";

export { CategoriesView } from "./categories/CategoriesView.jsx";
export { FavoritesView } from "./favorites/FavoritesView.jsx";

export { BookDetailDialog } from "./detail/BookDetailDialog.jsx";
export { BookDetailShell } from "./detail/shell/BookDetailShell.jsx";
export {
  BookDetailRightTabs,
  BookDetailOverviewTab,
  BookDetailTranslateTab,
  BookDetailMoreTab,
  BOOK_DETAIL_TABS,
} from "./detail/tabs/index.js";
export { createBookDetailDialogStore } from "./detail/book-detail-dialog-store.js";

export { createLibraryController } from "./domain/controller.js";

export type {
  AutoLoadCheckOptions,
  BookCardAction,
  BookCardActionHandlers,
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryBackgroundStage,
  LibraryBookSummary,
  LibraryCardBadge,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  LibraryEventPort,
  LibraryJobItem,
  LibraryProgress,
  LibraryRuntimeStatus,
  LibraryViewActions,
  LibraryViewMode,
  LibraryViewState,
  LibraryViewStore,
  RecentJobItem,
  RecentJobsReactViewPort,
  RecentJobsReactViewPortOptions,
  RecentJobsViewPortHandlers,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "./types.js";
