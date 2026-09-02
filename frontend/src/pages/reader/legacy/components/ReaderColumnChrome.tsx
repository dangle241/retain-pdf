// 栏间separatedentries与折叠把手:基线截图里可见(1px 竖线 + 栏边界中部小圆片),
// 位置All由 CSS 变量(--reader-left-w / --reader-right-w)计算,静态Rendering即可对齐.
// 探针Stage拖拽/折叠交互不接线(旧实现yes column-resizer.js / panel-collapse.js);
// 2b 决定由 rrp 统管三栏宽度还yes复用旧控制器.

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



