import { stringifyPretty } from "../../composition/external.js";

// Hai khối hiển thị nhỏ dùng chung cho panel chi tiết/replay gỡ lỗi bản dịch; bản viết lại JSX của
// renderField/renderTextBlock trong features/status-detail/formatters.js (cả hai
// đều nối markup và bị loại theo thiết kế §1.1; stringifyPretty là hàm định dạng thuần nên giữ lại
// và import trực tiếp).

export function InfoRow({ label, value }) {
  return (
    <div className="info-row translation-detail-row">
      <span className="label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

export function TextBlock({ label, value }) {
  return (
    <section className="translation-text-block">
      <div className="translation-debug-subhead">
        <h4>{label}</h4>
      </div>
      <pre>{stringifyPretty(value)}</pre>
    </section>
  );
}
