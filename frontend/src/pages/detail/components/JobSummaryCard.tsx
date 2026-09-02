// Meta-info card: "Run Information" / "Failure Diagnostics" etc., label/value row-style cards, plus a "Tips / Errors" plain-text card. Class names match the old detail.html exactly.

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
      <h2>Tips / Errors</h2>
      <pre id="detail-error-box" className="detail-log">{t("detail-error-box")}</pre>
    </article>
  );
}



