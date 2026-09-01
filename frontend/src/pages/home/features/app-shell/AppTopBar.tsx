// Top nav area ââ remove white card background: logo align left. "Library/Collection/Favorites/AI" center columns.
// Float directly on gray background. Pin Add/Search/Settings all three to bottom floating bar.
// (AppBottomBar.jsx)。
//
// Centering method: logo one line on each side. flex:1 spacer centers tabs horizontally. #developer-btn/
// #open-output-btn It is a contract id(Test reference),Retain in display:none in hidden container,Does not occupy layout.

import { LibraryTopTabs } from "../library/page/LibraryTopTabs.jsx";

export function AppTopBar({ activeTab, onTabChange }) {
  return (
    <app-shell-header class="app-shell-header">
      <header className="topbar library-topbar">
        <a
          className="hero-repo-link library-brand-link"
          href="https://github.com/wxyhgk/retain-pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img className="hero-repo-logo" src="src/assets/RetainPDF-logo.svg" alt="RetainPDF logo" />
          <span>RetainPDF</span>
        </a>
        <div className="hero-actions hidden" aria-hidden="true">
          <button id="developer-btn" type="button" className="secondary hidden" aria-hidden="true">Developer</button>
          <button id="open-output-btn" type="button" className="secondary hidden">Open Output Directory</button>
        </div>
        <div className="library-topbar-spacer" aria-hidden="true" />
        <LibraryTopTabs active={activeTab} onChange={onTabChange} />
        <div className="library-topbar-spacer" aria-hidden="true" />
      </header>
    </app-shell-header>
  );
}
