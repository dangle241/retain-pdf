// Container cuộn dùng chung + hai panel PDF (cổng kỹ thuật chính của giai đoạn 2a).
//
// #reader-scroll-shell vẫn là container cuộn dọc duy nhất (định vị tuyệt đối giữa cột trái/phải, overflow:auto),
// Group của react-resizable-panels là phần tử con, thay main#reader-grid cũ (grid 1fr/1fr).
//
// Ghi đè style đã được khảo sát/xác minh cho rrp v4 (theo đúng kế hoạch, không tự nghĩ thêm):
// - Group mặc định height:100%; overflow:hidden phải được ghi đè thành height:auto + overflow:visible,
//   để hai pane kéo tới chiều cao nội dung lớn nhất và shell cha cuộn thống nhất.
//   Khảo sát ghi minHeight:'100%', nhưng .reader-page có chiều cao auto nên min-height phần trăm không phân giải được;
//   giới hạn dưới của .reader-grid cũ là min-height:100vh, tại đây dùng 100vh để giữ tương đương pixel.
// - Cấu trúc Panel hai tầng: maxHeight:100% của flex item ngoài tự mất hiệu lực dưới Group có chiều cao auto;
//   tầng trong (nhận className/style) ghi đè maxHeight:'none', overflowY:'visible', overflowX:'clip'.
// - Separator rộng 0: trong chế độ đối chiếu, hai pane ở bố cục cũ mỗi bên chiếm một nửa và không kéo được; đường phân cách hình ảnh
//   được tái tạo bằng viền trái 1px của panel bản dịch (CSS cũ .reader-panel + .reader-panel không còn khớp vì
//   có phần tử Separator ở giữa). Chiều rộng 0 bảo đảm hai pane đúng bằng baseline; chiều rộng pane đi vào phép
//   tính thu phóng pdf.js, lệch 1px sẽ khiến toàn bộ văn bản lệch dưới pixel.

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
          // minWidth:0: .reader-page là display:grid; Group là grid item có
          // min-width:auto sẽ bị nội dung PDF kéo vượt 100% (bố cục cũ dùng minmax(0,1fr) để tránh cùng vấn đề).
          style={{ height: "auto", minHeight: "100vh", minWidth: 0, overflow: "visible" }}
        >
          <PdfPane pane="source" />
          <Separator
            id="reader-grid-separator"
            aria-label="Điều chỉnh chiều rộng bảng nguyên văn/bản dịch"
            style={{ width: 0, minWidth: 0, flexBasis: 0 }}
          />
          <PdfPane pane="translated" />
        </Group>
      </div>
    </div>
  );
}
