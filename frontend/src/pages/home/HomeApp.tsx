// Home page React Orchestration root.
//
// Structure comparison partials/main-content.html + dialogs.html mirror block by block;only keep at top
// Brand + Library/Category columns(AppTopBar.jsx, Remove white card background); Add/Search/Settings Three items
// Centered floating bar at bottom.(AppBottomBar.jsx,Replaces earlier separated AppBottomActions +
// LibrarySearchDock Two floating islands)。
// Other Blocks(library-view Grid, status Card, credentials/glossaries/status-detail etc.)
// Connected;ReaderDialog Navigate only reader.html (no UI).
// Custom element tag placeholder (<recent-jobs-dialog> etc.) Do not register definition in the new world. Lazy, no side effects.

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
// library-search-island Single registration point for custom elements. Legacy world by src/js/components/index.js
// Fallback side-effect import registration; This file follows cutover. After deletion, broken registration flow causes below
// <library-search-island> in JSX Render tag as lazy empty tag (Still on data contract, but search
// Feature fails silently.——Only visible in real browser rendering.,jsdom No error)Explicitly take over registration here.
import "../../js/islands/library-search/index.js";

function HomeShell() {
  // Restore state on reader exit. tab; otherwise default to library.
  const [activeLibraryTab, setActiveLibraryTab] = useState(readInitialLibraryTabFromReturn);
  const isLibraryTab = activeLibraryTab === "library";
  const isCategoriesTab = activeLibraryTab === "categories";
  const isFavoritesTab = activeLibraryTab === "favorites";
  const isAskTab = activeLibraryTab === "ask";
  // #31 Batch selection toolbar and bottom bar fixed at bottom center.,Use bottom bar during batch mode. CSS
// Hide (do not unmount â uninstalling search input will break library-search-island reference) make room
  // Batch toolbar,Mutually exclusive visibility.
  const [batchModeActive, setBatchModeActive] = useState(false);

// Collection/Favorites/AI tabView mount attempt restore panel Scroll (library by RecentJobsLibrary Restore after list present
  useHomeReturnRestore(isCategoriesTab || isFavoritesTab || isAskTab);

  return (
    <>
      <main id="app-shell" className="page app-shell" data-home-spa="">
        <AppTopBar activeTab={activeLibraryTab} onTabChange={setActiveLibraryTab} />
        <MockModeBanner />
        {/* Paper Heart Stage: Material/Proportional hierarchy (non-traditional symbol collage); sidebar filtering deferred */}
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
// AI Pin chat to bottom. Prevents scroll drift. "Upload / Settings" floating bar avoids covering input area
            <HomeAskView />
          ) : null}
        </div>
        <button id="open-query-btn" type="button" className="secondary hidden" aria-hidden="true">Recent Tasks</button>
        {/* 3b 占位:Recent tasks dialog */}
        <recent-jobs-dialog></recent-jobs-dialog>
        <SettingsHubDialog />
        <TranslationWorkflowDialog />
      </main>
      {/* dialogs.html Block:upload Professional Domain Translation Dialog + credentials Domain exists React transform,Remaining placeholders(3b) */}
      <CredentialsDialog />
      <GlossariesDialog />
      <developer-auth-dialog></developer-auth-dialog>
      <developer-settings-dialog></developer-settings-dialog>
      <PageRangeDialog />
      <StatusDetailDialog />
      <ReaderDialog />
      {/* Soft open reader. Fullscreen layer. Home page not unmount. Close. × No refresh */}
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
