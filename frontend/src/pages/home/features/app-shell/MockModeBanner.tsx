import {
  isMockMode,
  mockScenario,
} from "../../composition/external.js";

// Thanh gợi ý chế độ demo mock: hiển thị khi URL có ?mock=demo / parallel, v.v.
// Hướng dẫn người dùng mở sách thư viện → tab Dịch → Dịch toàn bộ để xem hoạt ảnh tiến độ live.

export function MockModeBanner() {
  if (!isMockMode()) {
    return null;
  }
  const scenario = mockScenario() || "demo";
  return (
    <div
      id="mock-mode-banner"
      className="mock-mode-banner"
      role="status"
      data-mock-scenario={scenario}
    >
      <strong>Chế độ demo mô phỏng</strong>
      <span>
        Hiện tại <code>?mock={scenario}</code>
        : không kết nối backend thật. Mở sách có huy hiệu “Thư viện” → tab “Dịch” → “Dịch toàn bộ”,
        bạn sẽ thấy tiến trình mô phỏng khoảng 16 giây trong phần chi tiết (OCR → Dịch → Kết xuất → Hoàn tất).
      </span>
    </div>
  );
}
