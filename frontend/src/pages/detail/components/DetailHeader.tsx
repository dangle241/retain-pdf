// Detail page hero area: title/Share prompt, four action links, breakpoint resume button, task metadata.
// DOM Reuse old structure and class names. detail.html,Ensure pixel parity.
//
// Note: #detail-rerun-btn disabled state from legacy logic (overview-renderer.js /
// resume.js bindRerunButton)Imperative management after mount;JSX Remove useEffect. Use constant state. disabled,
// React subsequent re-renders skip it (Virtual DOM no diff), imperative write preserved.

import { MetaRow } from "./JobSummaryCard.jsx";

function ActionLink({ id, link, onClick, children }: any) {
  const enabled = Boolean(link?.enabled);
  const href = enabled && link?.url ? link.url : "#";
  return (
    <a
      id={id}
      className={enabled ? "button-link secondary" : "button-link secondary disabled"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={link ? !enabled : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

export function DetailHeader({ t, links, onProtectedDownload }) {
  return (
    <section className="detail-hero">
      <div className="detail-hero-top">
        <div>
<h1>Task Details</h1>
          <p id="detail-head-note">{t("detail-head-note", "通过 `detail.html?job_id=...` Share Current Task Details")}</p>
        </div>
        <div className="detail-actions">
<ActionLink id="detail-reader-btn" link={links["detail-reader-btn"]}>Side-by-Side Reading</ActionLink>
          <ActionLink
            id="detail-pdf-btn"
            link={links["detail-pdf-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}.pdf`)}
          >
Download PDF
          </ActionLink>
          <ActionLink
            id="detail-markdown-raw-btn"
            link={links["detail-markdown-raw-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}.md`)}
          >
            Markdown
          </ActionLink>
          <ActionLink
            id="detail-markdown-json-btn"
            link={links["detail-markdown-json-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}-markdown.json`)}
          >
            Markdown JSON
          </ActionLink>
        </div>
      </div>
      <div className="detail-task-actions" aria-label="Task Actions">
        <button id="detail-rerun-btn" type="button" className="detail-trigger-btn" disabled>Resume/re-run</button>
        <span id="detail-rerun-status" className="detail-inline-note">{t("detail-rerun-status", "The current task is temporarily not recoverable.")}</span>
      </div>
      <div className="detail-meta-list">
        <MetaRow label="Job ID" id="detail-job-id" mono value={t("detail-job-id")} />
        <MetaRow label="status summary" id="detail-status-summary" value={t("detail-status-summary")} />
<MetaRow label="Current Stage" id="detail-stage-detail" value={t("detail-stage-detail")} />
        <MetaRow label="Completion time" id="detail-finished-at" value={t("detail-finished-at")} />
      </div>
    </section>
  );
}
