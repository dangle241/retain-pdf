// 左栏(导航占位):三栏骨架的常驻左栏,宽度由 --reader-left-w CSS 变量驱动(reader-page.css)。

export function ReaderLeftNav() {
  return (
    <aside id="reader-col-left" className="reader-col-left" aria-label="导航">
      <div className="reader-col-left-head">导航</div>
      <div className="reader-col-left-body">
        <p className="reader-col-left-placeholder">占位区</p>
        <p className="reader-col-left-hint">后续放摘录 / 批注汇总</p>
      </div>
    </aside>
  );
}
