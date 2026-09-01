// Metadata Card: label/value Row-style card shared by "Run Info" and "Failure Diagnosis",
// and "Tips / Error" Plain text card. Class name matches legacy. detail.html Identical.

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
<h2>Tips / Error</h2>
      <pre id="detail-error-box" className="detail-log">{t("detail-error-box")}</pre>
    </article>
  );
}
