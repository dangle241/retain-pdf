// Bottom triple-action floating bar(User requirement:Add left, Search center, Settings right,Synthesize one.)。
// Merged legacy. AppBottomActions(Add bottom-right./No Capsule settings are required. Consider removal.)+ LibrarySearchDock
// (Center search bar at bottom)——Previously two independent floating islands.,Center glass bar.
//
// Keep all contract IDs: library-add-pdf-btn / app-settings-btn / library-search-input
// (Test + library-search-island OK. Find element by ID).
//
// Key:hidden uses CSS display:none (do not unmount), search box stays in DOM ââ
// library-search-island grabs this input reference via getElementById in connectedCallback,
// Unmount, remount.(Batch mode entry/exit)Quote invalidation breaks search silently.(Leftover from previous batch selection
// Hidden danger)Change to hide, not uninstall.,References never expire.
// showSearch=false for "Category" tab: search semantics differ for this tab, do not render input (test
// Assert #library-search-input does not exist under classification tab), keep add only/Settings

import { useHomeServices } from "../../home-services-context.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useLibrarySearchBinding } from "../library/page/RecentJobsLibrary.jsx";
import { TRANSLATION_WORKFLOW_DIALOG } from "../../composition/external.js";

export function AppBottomBar({ showSearch = true, hidden = false }) {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const open = Boolean(dialog.open);
// Conditional hook calls not supported ââ always subscribe, only render input at render time if showSearch is true (under Category tab
// Holding only. query not displayed, side-effect free).
  const { query, onSearchChange } = useLibrarySearchBinding();

  return (
    <div className={`library-bottom-bar${hidden ? " is-hidden" : ""}`} aria-label="Quick Actions">
      <button
        id="library-add-pdf-btn"
        type="button"
        className={`library-bottom-icon-btn primary${open ? " is-active" : ""}`}
aria-label="Add PDF"
title="Add PDF"
        aria-controls="translation-workflow-dialog"
        aria-expanded={open ? "true" : "false"}
        data-workflow-open={open
          ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
          : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed}
        data-workflow-mode={dialog.mode}
        onClick={() => services.workflowDialog.requestOpenUpload()}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        {/* Decoration hook: default no-style zero-render (invisible to themes), skins can CSS Texture swap for it. */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>

      {showSearch ? (
        <div className="library-bottom-search" role="search">
          <input
            id="library-search-input"
            type="search"
            autoComplete="off"
            placeholder="Search books, tasks, or dates"
            aria-label="Search Books"
            value={query}
            onChange={onSearchChange}
          />
        </div>
      ) : null}

      <button
        id="app-settings-btn"
        type="button"
        className="library-bottom-icon-btn"
aria-label="Settings"
title="Settings"
        aria-controls="app-settings-dialog"
        onClick={() => services.settingsHub.dialogStore.open({ tab: "api" })}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" />
          <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
        </svg>
        {/* Decoration hook: same as add button, skin supports texture swapping */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>
    </div>
  );
}
