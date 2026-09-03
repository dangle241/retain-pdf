// Home page React orchestration root.
//
// Structure mirrors partials/main-content.html + dialogs.html block by block; the top only
// keeps brand + Library/Category tabs (AppTopBar.jsx, white-card background removed); Add/Search/Settings
// sit in one centered floating bottom bar (AppBottomBar.jsx, replacing the earlier split
// AppBottomActions + LibrarySearchDock islands).
// Remaining blocks (library-view Grid, status card, credentials/glossaries/status-detail, etc.)
// are wired up; ReaderDialog only navigates to reader.html (no UI).
// Placeholder custom-element tags (<recent-jobs-dialog>, etc.) are not defined in the new world and have no side effects.

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
// Sole registration point for the library-search-island custom element. The old world registered
// it via a fallback side-effect import in src/js/components/index.js; after that file is deleted
// at cutover, the chain breaks and the <library-search-island> tag below renders as an inert
// empty tag (the data contract is still there, but search silently dies——only a real browser
// render shows it; jsdom will not error). Explicitly take over registration here.
import "../../js/islands/library-search/index.js";

function HomeShell() {
  // When returning from Reader, restore the tab left on; otherwise default to Library.
  const [activeLibraryTab, setActiveLibraryTab] = useState(readInitialLibraryTabFromReturn);
  const isLibraryTab = activeLibraryTab === "library";
  const isCategoriesTab = activeLibraryTab === "categories";
  const isFavoritesTab = activeLibraryTab === "favorites";
  const isAskTab = activeLibraryTab === "ask";
  // #31 Batch-select tools bar and bottom bar are both fixed bottom-center. In batch mode the
  // bottom bar is CSS-hidden (not unmounted——unmounting the search input would drop
  // library-search-island's refs) so the batch tools bar can take the slot; they are never both visible.
  const [batchModeActive, setBatchModeActive] = useState(false);

  // Collection/Favorite/AI tab: try restoring panel scroll as soon as the view mounts (Library is restored by RecentJobsLibrary after it has a list)
  useHomeReturnRestore(isCategoriesTab || isFavoritesTab || isAskTab);

  return (
    <>
      <main id="app-shell" className="page app-shell" data-home-spa="">
        <AppTopBar activeTab={activeLibraryTab} onTabChange={setActiveLibraryTab} />
        <MockModeBanner />
        {/* Paper-heart stage: material/scale layers (not a traditional symbol collage); sidebar filter not yet */}
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
            // AI chat does not mount the bottom "Upload / Settings" float, so it does not cover the input area
            <HomeAskView />
          ) : null}
        </div>
        <button id="open-query-btn" type="button" className="secondary hidden" aria-hidden="true">Recent Jobs</button>
        {/* 3b placeholder: Recent Jobs dialog */}
        <recent-jobs-dialog></recent-jobs-dialog>
        <SettingsHubDialog />
        <TranslationWorkflowDialog />
      </main>
      {/* dialogs.html block: upload-domain professional translation dialog + credentials already React; rest are 3b placeholders */}
      <CredentialsDialog />
      <GlossariesDialog />
      <developer-auth-dialog></developer-auth-dialog>
      <developer-settings-dialog></developer-settings-dialog>
      <PageRangeDialog />
      <StatusDetailDialog />
      <ReaderDialog />
      {/* Soft-open Reader: fullscreen layer; home page stays mounted (close × does not refresh) */}
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




