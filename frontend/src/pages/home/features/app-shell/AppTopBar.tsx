// Top navigation area — user requested removing white card background: logo at far left,
// "Library/Collection/Favorite/AI" tab bar centered, floating directly on the grey page
// background. Add / Search / Settings all sink to one entry floating bar at the bottom
// (AppBottomBar.jsx).
//
// Centering approach: logo left, one flex:1 spacer on each side pushing tabs to center.
// #developer-btn / #open-output-btn are contract ids (test references), kept in a
// display:none hidden container, not taking up layout space.

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




