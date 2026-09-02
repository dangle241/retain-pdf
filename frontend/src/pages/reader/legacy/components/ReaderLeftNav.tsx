// 左栏(导航占位):三栏骨架的常驻左栏,宽度由 --reader-left-w CSS 变量驱动(reader-page.css).

export function ReaderLeftNav() {
  return (
    <aside id="reader-col-left" className="reader-col-left" aria-label="Navigation">
      <div className="reader-col-left-head">Navigation</div>
      <div className="reader-col-left-body">
        <p className="reader-col-left-placeholder">Placeholder</p>
        <p className="reader-col-left-hint">Excerpt / annotations summary will go here</p>
      </div>
    </aside>
  );
}



