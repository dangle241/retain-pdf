// Bottom page number HUD: Initial hidden, page number/progress/Pattern copy imperative. view Layer write
// (view.js setPageIndicator / setReaderModeHud, driven by interaction-flow).

export function ReaderPageHud() {
  return (
    <div id="reader-page-indicator" className="reader-page-indicator reader-bottom-hud hidden" aria-live="polite">
<span id="reader-bottom-hud-page" className="reader-bottom-hud-page">Page 1 / 1</span>
      <span className="reader-bottom-hud-progress" aria-hidden="true">
        <span id="reader-bottom-hud-progress-bar" className="reader-bottom-hud-progress-bar"></span>
      </span>
<span id="reader-bottom-hud-mode" className="reader-bottom-hud-mode">Parallel View</span>
    </div>
  );
}
