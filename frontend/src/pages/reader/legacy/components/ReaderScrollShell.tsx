// total享滚动容器 + 双 PDF 面板(Phase 2a 的技术闸门books体).
//
// #reader-scroll-shell 仍yes唯一纵向滚动容器(绝对Locate于左右栏之间,overflow:auto),
// react-resizable-panels 的 Group yes它的子元素,替代旧 main#reader-grid(grid 1fr/1fr).
//
// rrp v4 预研核实的 style 覆盖(照抄计划,不自行发明):
// - Group 默认 height:100%; overflow:hidden 必须覆盖为 height:auto + overflow:visible,
//   让两 pane 拉到内容最高者, 由父 shell 统一滚动.
//   预研写 minHeight:'100%',但 .reader-page yes auto 高,百m比 min-height parse不出来;
//   旧 .reader-grid 的下限yes min-height:100vh,这里取 100vh 保持像素等价.
// - Panel 双层结构:外层 flex item 的 maxHeight:100% 在 auto 高 Group 下自动失效;
//   内层(接收 className/style)覆盖 maxHeight:'none', overflowY:'visible', overflowX:'clip'.
// - Separator 取 0 宽:Side-by-side模式两 pane 在旧布局就yes各占一半, 不可拖;separated视觉
//   由Translation面板的 1px 左边框复刻(旧 CSS .reader-panel + .reader-panel 因中间隔着
//   Separator 元素不再命中).0 宽保证两 pane 与基线严格同宽——pane 宽度进 pdf.js
//   缩放计算,差 1px 会让整片文books亚像素漂移.

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
          // minWidth:0:.reader-page yes display:grid,Group 作为 grid item 的
          // min-width:auto 会被 PDF 内容撑破 100%(旧布局用 minmax(0,1fr) 规避同一Question)
          style={{ height: "auto", minHeight: "100vh", minWidth: 0, overflow: "visible" }}
        >
          <PdfPane pane="source" />
          <Separator
            id="reader-grid-separator"
            aria-label="调整Source/Translation面板宽度"
            style={{ width: 0, minWidth: 0, flexBasis: 0 }}
          />
          <PdfPane pane="translated" />
        </Group>
      </div>
    </div>
  );
}




