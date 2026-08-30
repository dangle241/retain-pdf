// Thẻ ngữ cảnh gỡ lỗi thất bại. #detail-failure-debug-context là "đảo mệnh lệnh":
// nội dung được mô-đun cũ src/js/job-detail/failure.js (qua overview-renderer.js)
// ghi bằng innerHTML sau khi tải dữ liệu. Phía React dùng memo cố định thành container lá và
// không kết xuất nút con động, nên kết xuất lại không chạm nội dung đã ghi mệnh lệnh.

import { memo } from "react";

export const ErrorDiagnostics = memo(function ErrorDiagnostics() {
  return (
    <article className="detail-card detail-card-wide">
      <h2>Ngữ cảnh gỡ lỗi thất bại</h2>
      <div id="detail-failure-debug-context" className="detail-debug-context">
        <div className="detail-empty">Chưa có ngữ cảnh lỗi có cấu trúc</div>
      </div>
    </article>
  );
});
