// home 页 React 编排根。
//
// 结构对照 partials/main-content.html + dialogs.html 逐区块镜像;顶部只留
// 品牌 + 图书馆/分类分栏(AppTopBar.jsx,去掉白卡背景);添加/搜索/设置 三样
// 收进底部一条居中浮动栏(AppBottomBar.jsx,取代早期分离的 AppBottomActions +
// LibrarySearchDock 两个浮岛)。
// 其余区块(library-view 网格、status 卡、credentials/glossaries/status-detail 等)
// 已陆续接上;ReaderDialog 仅导航到 reader.html(无 UI)。
// 占位自定义元素标签(<recent-jobs-dialog> 等)在新世界不注册定义,惰性无副作用。

import { useState } from "react";
import { HomeServicesProvider } from "./home-services-context.js";
import type { HomeServices } from "./composition/types.js";
import { AppTopBar } from "./features/app-shell/AppTopBar.jsx";
import { AppBottomBar } from "./features/app-shell/AppBottomBar.jsx";
import { MockModeBanner } from "./features/app-shell/MockModeBanner.jsx";
import { TranslationWorkflowDialog } from "./features/workflow/TranslationWorkflowDialog.jsx";
import { PageRangeDialog } from "./features/upload/PageRangeDialog.jsx";
import {
  RecentJobsLibrary,
  CategoriesView,
  FavoritesView,
  BookDetailDialog,
} from "./features/library/index.js";
import { HomeAskView } from "./features/home-ask/HomeAskView.js";
import { CredentialsDialog } from "./features/credentials/CredentialsDialog.jsx";
import { GlossariesDialog } from "./features/glossaries/GlossariesDialog.jsx";
import { SettingsHubDialog } from "./features/settings/SettingsHubDialog.jsx";
import { StatusDetailDialog } from "./features/status-detail/StatusDetailDialog.jsx";
import { ReaderDialog } from "./features/reader/ReaderDialog.jsx";
import { SoftReaderHost } from "./features/reader/SoftReaderHost.jsx";
import { CollectionManageDialog } from "./features/collections/CollectionManageDialog.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import {
  readInitialLibraryTabFromReturn,
  useHomeReturnRestore,
} from "./features/library/page/useHomeReturnRestore.js";
// library-search-island 自定义元素的唯一注册点。旧世界由 src/js/components/index.js
// 兜底 side-effect import 注册;该文件随 cutover 删除后,注册链路断了会导致下方
// JSX 里的 <library-search-island> 标签渲染成惰性空标签(数据契约上仍在,但搜索
// 功能静默失效——只有真实浏览器渲染能看出来,jsdom 不会报错)。这里显式接管注册。
import "../../js/islands/library-search/index.js";

function HomeShell() {
  // 从阅读器返回时尽量恢复离开前的 tab；否则默认图书馆。
  const [activeLibraryTab, setActiveLibraryTab] = useState(readInitialLibraryTabFromReturn);
  const isLibraryTab = activeLibraryTab === "library";
  const isCategoriesTab = activeLibraryTab === "categories";
  const isFavoritesTab = activeLibraryTab === "favorites";
  const isAskTab = activeLibraryTab === "ask";
  // #31 批量选择工具栏和底部栏都固定在底部居中,批量模式期间底部栏用 CSS
  // 隐藏(不卸载——搜索 input 卸载会让 library-search-island 的引用失效)让位
  // 给批量工具栏,两者不同时可见。
  const [batchModeActive, setBatchModeActive] = useState(false);

  // 合集/收藏/AI tab：视图挂载即可尝试恢复 panel 滚动（图书馆由 RecentJobsLibrary 在有列表后恢复）
  useHomeReturnRestore(isCategoriesTab || isFavoritesTab || isAskTab);

  return (
    <>
      <main id="app-shell" className="page app-shell" data-home-spa="">
        <AppTopBar activeTab={activeLibraryTab} onTabChange={setActiveLibraryTab} />
        <MockModeBanner />
        {/* 纸心舞台：材质/比例层级（非传统符号拼贴）；侧栏筛选暂不做 */}
        <div className="home-paper-stage">
          {isLibraryTab ? (
            <>
              <RecentJobsLibrary {...({ onBatchModeChange: setBatchModeActive } as any)} />
              <AppBottomBar showSearch hidden={batchModeActive} />
              <library-search-island></library-search-island>
            </>
          ) : isCategoriesTab ? (
            <>
              <CategoriesView />
              <AppBottomBar showSearch={false} />
            </>
          ) : isFavoritesTab ? (
            <>
              <FavoritesView />
              <AppBottomBar showSearch={false} />
            </>
          ) : isAskTab ? (
            // AI 对话不挂底部「上传 / 设置」浮栏，避免压住输入区
            <HomeAskView />
          ) : null}
        </div>
        <button id="open-query-btn" type="button" className="secondary hidden" aria-hidden="true">最近任务</button>
        {/* 3b 占位:最近任务对话框 */}
        <recent-jobs-dialog></recent-jobs-dialog>
        <SettingsHubDialog />
        <TranslationWorkflowDialog />
      </main>
      {/* dialogs.html 区块:upload 域的专业翻译对话框 + credentials 域已 React 化,其余占位(3b) */}
      <CredentialsDialog />
      <GlossariesDialog />
      <developer-auth-dialog></developer-auth-dialog>
      <developer-settings-dialog></developer-settings-dialog>
      <PageRangeDialog />
      <StatusDetailDialog />
      <ReaderDialog />
      {/* 软打开阅读器：全屏层，主页不卸载（关 × 不刷新） */}
      <SoftReaderHost />
      <CollectionManageDialog />
      <BookDetailDialog />
      <DownloadToastHost />
    </>
  );
}

export function HomeApp({ services }: { services: HomeServices }) {
  return (
    <HomeServicesProvider value={services}>
      <HomeShell />
    </HomeServicesProvider>
  );
}
