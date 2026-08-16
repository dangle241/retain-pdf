// Thẻ siêu thông tin: thẻ dòng label/value dùng chung cho "Thông tin chạy" và "Chẩn đoán lỗi",
// cùng thẻ văn bản thuần "Thông báo / Lỗi". Tên class hoàn toàn giống detail.html cũ.

export function MetaRow({ label, id, mono = false, value }) {
  return (
    <div className="detail-meta-row">
      <span className="label">{label}</span>
      <span id={id} className={mono ? "value mono" : "value"}>{value}</span>
    </div>
  );
}

export function JobSummaryCard({ title, children }) {
  return (
    <article className="detail-card">
      <h2>{title}</h2>
      <div className="detail-meta-list">
        {children}
      </div>
    </article>
  );
}

export function ErrorNoticeCard({ t }) {
  return (
    <article className="detail-card">
      <h2>Thông báo / Lỗi</h2>
      <pre id="detail-error-box" className="detail-log">{t("detail-error-box")}</pre>
    </article>
  );
}
