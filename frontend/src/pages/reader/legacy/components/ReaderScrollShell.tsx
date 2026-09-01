// Shared scroll container + Dual PDF panels (Phase 2a technical gate body).
//
// #reader-scroll-shell Remains sole vertical scroll container(Absolutely position between left and right columns.,overflow:auto),
// react-resizable-panels Group is its child element, replaces old main#reader-grid (grid 1fr/1fr).
//
// rrp v4 Pre-research verification. style override (Copy plan, Do not invent.):
// - Group default height:100%; overflow:hidden. Must override to height:auto + overflow:visible,
//   Let both pane Scroll to topmost content by parent. shell Unify scrolling.
//   pre-researched minHeight:'100%', but .reader-page is auto height; percentage min-height cannot be resolved;
//   Old .reader-grid lower bound is min-height:100vh. Use 100vh here to maintain pixel equivalence.
// - Panel Two-layer structure: Outer flex item's maxHeight:100% expires automatically in auto-height Group below.;
//   Inner layer (receives className/style) overrides maxHeight:'none', overflowY:'visible', overflowX:'clip'.
// - Separator width 0: Compare Mode 2 pane old layout: 50/50 split, non-draggable.; Visual separator
//   Replicate 1px left border from translation panel (old CSS .reader-panel + .reader-panel separated by
//   Separator Element no longer hit)。0 Guarantee width two pane Strictly same width as baseline.——pane Width in pdf.js
//   Scale calculation,difference 1px Causes subpixel drift across entire text block.

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
// minWidth:0: .reader-page is display:grid, Group is a grid item.
// min-width:auto would be overflowed by PDF content 100% (legacy layout used minmax(0,1fr) to avoid this issue)
          style={{ height: "auto", minHeight: "100vh", minWidth: 0, overflow: "visible" }}
        >
          <PdfPane pane="source" />
          <Separator
            id="reader-grid-separator"
            aria-label="Adjust text. Reason: Improve clarity. Next step: Review changes./translation panel width"
            style={{ width: 0, minWidth: 0, flexBasis: 0 }}
          />
          <PdfPane pane="translated" />
        </Group>
      </div>
    </div>
  );
}
