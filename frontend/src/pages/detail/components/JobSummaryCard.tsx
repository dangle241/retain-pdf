// 元信息卡片:"Run Information""Failure Diagnostics"total用的 label/value 行式卡片,
// 以及"Tips / Errors"纯文books卡片.类名与旧 detail.html 完全一致.

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



