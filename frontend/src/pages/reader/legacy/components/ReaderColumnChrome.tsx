// 栏间分隔条与折叠把手:基线截图里可见(1px 竖线 + 栏边界中部小圆片),
// 位置全部由 CSS 变量(--reader-left-w / --reader-right-w)计算,静态渲染即可对齐。
// 探针阶段拖拽/折叠交互不接线(旧实现是 column-resizer.js / panel-collapse.js);
// 2b 决定由 rrp 统管三栏宽度还是复用旧控制器。

export function ReaderColumnChrome() {
  return (
    <>
      <div id="reader-col-resizer-left" className="reader-col-resizer reader-col-resizer-left" role="separator" aria-orientation="vertical" aria-label="拖动调整左栏宽度" title="拖动调整宽度，双击复位"></div>
      <div id="reader-col-resizer-right" className="reader-col-resizer reader-col-resizer-right" role="separator" aria-orientation="vertical" aria-label="拖动调整右栏宽度" title="拖动调整宽度，双击复位"></div>
      <button id="reader-left-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-left" aria-label="折叠左栏" aria-expanded="true" title="折叠 / 展开左栏"></button>
      <button id="reader-right-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-right" aria-label="折叠右栏" aria-expanded="true" title="折叠 / 展开右栏"></button>
    </>
  );
}
