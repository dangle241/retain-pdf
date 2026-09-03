// Column separators and collapse handles: visible in baseline screenshot (1px vertical line
// + small circle at mid column boundary), position all calculated by CSS variables
// (--reader-left-w / --reader-right-w), static rendering aligns them.
// Probe stage drag/collapse interaction not wired yet (old implementation uses
// column-resizer.js / panel-collapse.js); Phase 2b decides whether rrp manages all
// three column widths or reuses old controllers.

export function ReaderColumnChrome() {
  return (
    <>
      <div id="reader-col-resizer-left" className="reader-col-resizer reader-col-resizer-left" role="separator" aria-orientation="vertical" aria-label="Drag to resize left panel width" title="Drag to resize width, double-click to reset"></div>
      <div id="reader-col-resizer-right" className="reader-col-resizer reader-col-resizer-right" role="separator" aria-orientation="vertical" aria-label="Drag to resize right panel width" title="Drag to resize width, double-click to reset"></div>
      <button id="reader-left-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-left" aria-label="Collapse left panel" aria-expanded="true" title="Collapse / expand left panel"></button>
      <button id="reader-right-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-right" aria-label="Collapse right panel" aria-expanded="true" title="Collapse / expand right panel"></button>
    </>
  );
}


