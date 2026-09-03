// Shared scroll container + dual PDF panel (Phase 2a technical gate body).
//
// #reader-scroll-shell is still the only vertical scroll container (absolutely positioned
// between left/right columns, overflow:auto), react-resizable-panels' Group is its child
// element, replacing old main#reader-grid (grid 1fr/1fr).
//
// rrp v4 pre-research verified style overrides (copy the plan, don't improvise):
// - Group default height:100%; overflow:hidden must be overridden to height:auto + overflow:visible,
//   so both panes stretch to the tallest content, with parent shell handling scrolling.
//   Pre-research wrote minHeight:'100%', but .reader-page has auto height, percentage min-height
//   can't parse; old .reader-grid had min-height:100vh floor, here we take 100vh to maintain
//   pixel equivalence.
// - Panel dual-layer structure: outer flex item's maxHeight:100% automatically becomes ineffective
//   under auto-height Group; inner layer (receiving className/style) overrides maxHeight:'none',
//   overflowY:'visible', overflowX:'clip'.
// - Separator takes 0 width: Side-by-side mode two panes split the old layout equally, non-draggable;
//   separated visuals are replicated by the Translation panel's 1px left border (old CSS
//   .reader-panel + .reader-panel rules no longer apply because the Separator element is between
//   them). 0 width ensures both panes match baseline width exactly — pane width feeds into pdf.js
//   scaling calculations, 1px difference causes subpixel text drift across the entire document.

import { Group, Separator } from "react-resizable-panels";
import { PdfPane } from "./PdfPane.jsx";
import { ReaderPageHud } from "./ReaderPageHud.jsx";

export function ReaderScrollShell() {
  return (
    <div id="reader-scroll-shell" className="reader-scroll-shell">
      <div className="reader-page">
        <ReaderPageHud />
        <Group
          id="reader-grid"
          orientation="horizontal"
          // minWidth:0: .reader-page is display:grid, Group as grid item's
          // min-width:auto gets stretched to 100% by PDF content (old layout used minmax(0,1fr) to
          // avoid the same issue)
          style={{ height: "auto", minHeight: "100vh", minWidth: 0, overflow: "visible" }}
        >
          <PdfPane pane="source" />
          <Separator
            id="reader-grid-separator"
            aria-label="Adjust source/translation panel width"
            style={{ width: 0, minWidth: 0, flexBasis: 0 }}
          />
          <PdfPane pane="translated" />
        </Group>
      </div>
    </div>
  );
}


