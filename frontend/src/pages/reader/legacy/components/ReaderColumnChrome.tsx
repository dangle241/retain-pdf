// Divider and collapse handle:Visible in baseline screenshot.(1px Vertical bar + Small circular tab at column boundary center),
// Positions fully determined by CSS variables (--reader-left-w / --reader-right-w) calculation; static render aligns.
// Drag probe phase/Collapse interaction not wired.(Legacy implementation is column-resizer.js / panel-collapse.js);
// 2b Decided by rrp Reuse legacy controller for three-column width management.

export function ReaderColumnChrome() {
  return (
    <>
      <div id="reader-col-resizer-left" className="reader-col-resizer reader-col-resizer-left" role="separator" aria-orientation="vertical" aria-label="Drag to resize left column" title="Drag to resize width. Double-click reset."></div>
<div id="reader-col-resizer-right" className="reader-col-resizer reader-col-resizer-right" role="separator" aria-orientation="vertical" aria-label="Drag to resize right column" title="Drag to resize width. Double-click reset."></div>
<button id="reader-left-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-left" aria-label="Collapse left sidebar" aria-expanded="true" title="Collapse / Expand left panel"></button>
<button id="reader-right-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-right" aria-label="Collapse right panel" aria-expanded="true" title="Collapse / Expand right panel"></button>
    </>
  );
}
