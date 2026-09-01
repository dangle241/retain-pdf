// Top bar three tabs (Source/Translation/Compare) initial render in probe phase. compare Active state;
// Click to toggle handled by mode-controller (imperative), React skips re-rendering these buttons.

export function ReaderTopbar() {
  return (
    <header className="reader-topbar">
<div className="reader-tabs" role="tablist" aria-label="Reading Mode">
<button id="reader-tab-source" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-source" tabIndex={-1} data-reader-mode="source">Source</button>
<button id="reader-tab-translated" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-translated" tabIndex={-1} data-reader-mode="translated">Translation</button>
<button id="reader-tab-compare" type="button" className="reader-tab is-active" role="tab" aria-selected="true" aria-controls="reader-grid" data-reader-mode="compare">Compare Reading</button>
      </div>
    </header>
  );
}
