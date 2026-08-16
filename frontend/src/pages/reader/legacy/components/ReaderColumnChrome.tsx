// Thanh phân cách và tay nắm thu gọn giữa các cột: hiển thị trong ảnh baseline (đường dọc 1px + nút tròn nhỏ giữa ranh giới cột),
// toàn bộ vị trí được tính bằng biến CSS (--reader-left-w / --reader-right-w), render tĩnh là đủ căn chỉnh.
// Ở giai đoạn probe chưa nối tương tác kéo/thu gọn (triển khai cũ là column-resizer.js / panel-collapse.js);
// 2b quyết định để rrp quản lý toàn bộ chiều rộng ba cột hay tái sử dụng controller cũ.

export function ReaderColumnChrome() {
  return (
    <>
      <div id="reader-col-resizer-left" className="reader-col-resizer reader-col-resizer-left" role="separator" aria-orientation="vertical" aria-label="Kéo để điều chỉnh chiều rộng cột trái" title="Kéo để điều chỉnh chiều rộng, bấm đúp để đặt lại"></div>
      <div id="reader-col-resizer-right" className="reader-col-resizer reader-col-resizer-right" role="separator" aria-orientation="vertical" aria-label="Kéo để điều chỉnh chiều rộng cột phải" title="Kéo để điều chỉnh chiều rộng, bấm đúp để đặt lại"></div>
      <button id="reader-left-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-left" aria-label="Thu gọn cột trái" aria-expanded="true" title="Thu gọn / Mở rộng cột trái"></button>
      <button id="reader-right-collapse-btn" type="button" className="reader-col-collapse reader-col-collapse-right" aria-label="Thu gọn cột phải" aria-expanded="true" title="Thu gọn / Mở rộng cột phải"></button>
    </>
  );
}
