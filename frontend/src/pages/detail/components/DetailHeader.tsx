// 详情pages hero 区:Title/share提示, 四个动作链接, 断点resume按钮, 任务元信息.
// DOM 结构与类名照搬旧 detail.html,保证像素平权.
//
// 注意:#detail-rerun-btn 的 disabled 由旧世界逻辑(overview-renderer.js /
// resume.js bindRerunButton)在挂载后命令式Manage;JSX 里恒定Rendering disabled,
// React 后续重Rendering不会碰它(虚拟 DOM None diff),命令式写入得以保留.

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
          <h1>Job Details</h1>
          <p id="detail-head-note">{t("detail-head-note", "通过 `detail.html?job_id=...` 可直接shareCurrentJob Details.")}</p>
        </div>
        <div className="detail-actions">
          <ActionLink id="detail-reader-btn" link={links["detail-reader-btn"]}>Side-by-side Reader</ActionLink>
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
      <div className="detail-task-actions" aria-label="任务Action">
        <button id="detail-rerun-btn" type="button" className="detail-trigger-btn" disabled>断点resume/重新运行</button>
        <span id="detail-rerun-status" className="detail-inline-note">{t("detail-rerun-status", "The current job cannot be resumed.")}</span>
      </div>
      <div className="detail-meta-list">
        <MetaRow label="Job ID" id="detail-job-id" mono value={t("detail-job-id")} />
        <MetaRow label="StatusSummary" id="detail-status-summary" value={t("detail-status-summary")} />
        <MetaRow label="Current Stage" id="detail-stage-detail" value={t("detail-stage-detail")} />
        <MetaRow label="DoneTime" id="detail-finished-at" value={t("detail-finished-at")} />
      </div>
    </section>
  );
}




