// 共享滚动容器 + 双 PDF 面板(Phase 2a 的技术闸门本体)。
//
// #reader-scroll-shell 仍是唯一纵向滚动容器(绝对定位于左右栏之间,overflow:auto),
// react-resizable-panels 的 Group 是它的子元素,替代旧 main#reader-grid(grid 1fr/1fr)。
//
// rrp v4 预研核实的 style 覆盖(照抄计划,不自行发明):
// - Group 默认 height:100%; overflow:hidden 必须覆盖为 height:auto + overflow:visible,
//   让两 pane 拉到内容最高者、由父 shell 统一滚动。
//   预研写 minHeight:'100%',但 .reader-page 是 auto 高,百分比 min-height 解析不出来;
//   旧 .reader-grid 的下限是 min-height:100vh,这里取 100vh 保持像素等价。
// - Panel 双层结构:外层 flex item 的 maxHeight:100% 在 auto 高 Group 下自动失效;
//   内层(接收 className/style)覆盖 maxHeight:'none'、overflowY:'visible'、overflowX:'clip'。
// - Separator 取 0 宽:对照模式两 pane 在旧布局就是各占一半、不可拖;分隔视觉
//   由译文面板的 1px 左边框复刻(旧 CSS .reader-panel + .reader-panel 因中间隔着
//   Separator 元素不再命中)。0 宽保证两 pane 与基线严格同宽——pane 宽度进 pdf.js
//   缩放计算,差 1px 会让整片文本亚像素漂移。

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
          // minWidth:0:.reader-page 是 display:grid,Group 作为 grid item 的
          // min-width:auto 会被 PDF 内容撑破 100%(旧布局用 minmax(0,1fr) 规避同一问题)
          style={{ height: "auto", minHeight: "100vh", minWidth: 0, overflow: "visible" }}
        >
          <PdfPane pane="source" />
          <Separator
            id="reader-grid-separator"
            aria-label="调整原文/译文面板宽度"
            style={{ width: 0, minWidth: 0, flexBasis: 0 }}
          />
          <PdfPane pane="translated" />
        </Group>
      </div>
    </div>
  );
}
