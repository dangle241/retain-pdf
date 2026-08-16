// Ba tab trên thanh đầu (bản gốc/bản dịch/đối chiếu). Ở giai đoạn probe, render ban đầu đã kích hoạt compare;
// chuyển bằng click do mode-controller (mệnh lệnh) tiếp quản, React không render lại các nút này.

export function ReaderTopbar() {
  return (
    <header className="reader-topbar">
      <div className="reader-tabs" role="tablist" aria-label="Chế độ đọc">
        <button id="reader-tab-source" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-source" tabIndex={-1} data-reader-mode="source">Nguyên văn</button>
        <button id="reader-tab-translated" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-translated" tabIndex={-1} data-reader-mode="translated">Bản dịch</button>
        <button id="reader-tab-compare" type="button" className="reader-tab is-active" role="tab" aria-selected="true" aria-controls="reader-grid" data-reader-mode="compare">Đọc đối chiếu</button>
      </div>
    </header>
  );
}
