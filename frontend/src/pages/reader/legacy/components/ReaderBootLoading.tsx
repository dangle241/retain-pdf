// Startup progress overlay: Initially visible, progress copy/progress bar/hidden all via imperative view layer driver
// (src/js/reader/view.js + progress-presenter.js),React Render container once.

export function ReaderBootLoading() {
  return (
    <div id="reader-boot-loading" className="reader-boot-loading" aria-live="polite">
      <div className="reader-boot-loading-card">
        <div id="reader-boot-loading-text" className="reader-boot-loading-text">Preparing side-by-side reading.…</div>
        <div className="reader-boot-loading-track">
          <span id="reader-boot-loading-bar" className="reader-boot-loading-bar"></span>
        </div>
      </div>
    </div>
  );
}
