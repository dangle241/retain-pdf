// Cột trái (placeholder điều hướng): cột trái thường trực của khung ba cột, chiều rộng do biến CSS --reader-left-w điều khiển (reader-page.css).

export function ReaderLeftNav() {
  return (
    <aside id="reader-col-left" className="reader-col-left" aria-label="Điều hướng">
      <div className="reader-col-left-head">Điều hướng</div>
      <div className="reader-col-left-body">
        <p className="reader-col-left-placeholder">Khu vực giữ chỗ</p>
        <p className="reader-col-left-hint">Dành cho phần tổng hợp trích đoạn / chú thích sau này</p>
      </div>
    </aside>
  );
}
