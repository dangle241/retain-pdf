// Bottom page number HUD: initially hidden, page number/progress/mode text written by
// imperative view layer (view.js setPageIndicator / setReaderModeHud, driven by interaction-flow).

export function ReaderPageHud() {
  return (
    <div id="reader-page-indicator" className="reader-page-indicator reader-bottom-hud hidden" aria-live="polite">
      <span id="reader-bottom-hud-page" className="reader-bottom-hud-page">Page 1 / 1 pages</span>
      <span className="reader-bottom-hud-progress" aria-hidden="true">
        <span id="reader-bottom-hud-progress-bar" className="reader-bottom-hud-progress-bar"></span>
      </span>
      <span id="reader-bottom-hud-mode" className="reader-bottom-hud-mode">Side-by-side</span>
    </div>
  );
}


