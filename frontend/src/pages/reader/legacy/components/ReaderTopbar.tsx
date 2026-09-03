// Topbar three tabs (Source/Translation/Side-by-side). Probe stage initial rendering compares
// active state; click switching is handled by mode-controller (imperative), React does not
// re-render these buttons.

export function ReaderTopbar() {
  return (
    <header className="reader-topbar">
      <div className="reader-tabs" role="tablist" aria-label="Reading mode">
        <button id="reader-tab-source" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-source" tabIndex={-1} data-reader-mode="source">Source</button>
        <button id="reader-tab-translated" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-translated" tabIndex={-1} data-reader-mode="translated">Translation</button>
        <button id="reader-tab-compare" type="button" className="reader-tab is-active" role="tab" aria-selected="true" aria-controls="reader-grid" data-reader-mode="compare">Side-by-side Reader</button>
      </div>
    </header>
  );
}

