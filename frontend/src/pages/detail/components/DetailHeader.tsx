// Vùng hero trang chi tiết: tiêu đề/gợi ý chia sẻ, bốn liên kết hành động, nút tiếp tục từ điểm dừng và siêu dữ liệu tác vụ.
// Giữ nguyên cấu trúc DOM và tên class từ detail.html cũ để bảo đảm tương đương từng pixel.
//
// Lưu ý: disabled của #detail-rerun-btn được logic cũ (overview-renderer.js /
// resume.js bindRerunButton) quản lý mệnh lệnh sau khi gắn; JSX luôn kết xuất disabled,
// các lần kết xuất React sau không chạm vào vì DOM ảo không có diff, nên ghi mệnh lệnh được giữ.

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
          <h1>Chi tiết tác vụ</h1>
          <p id="detail-head-note">{t("detail-head-note", "Có thể chia sẻ trực tiếp chi tiết tác vụ hiện tại qua `detail.html?job_id=...`.")}</p>
        </div>
        <div className="detail-actions">
          <ActionLink id="detail-reader-btn" link={links["detail-reader-btn"]}>Đọc đối chiếu</ActionLink>
          <ActionLink
            id="detail-pdf-btn"
            link={links["detail-pdf-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}.pdf`)}
          >
            Tải PDF
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
      <div className="detail-task-actions" aria-label="Thao tác tác vụ">
        <button id="detail-rerun-btn" type="button" className="detail-trigger-btn" disabled>Tiếp tục từ điểm dừng / Chạy lại</button>
        <span id="detail-rerun-status" className="detail-inline-note">{t("detail-rerun-status", "Tác vụ hiện tại chưa thể khôi phục.")}</span>
      </div>
      <div className="detail-meta-list">
        <MetaRow label="Job ID" id="detail-job-id" mono value={t("detail-job-id")} />
        <MetaRow label="Tóm tắt trạng thái" id="detail-status-summary" value={t("detail-status-summary")} />
        <MetaRow label="Giai đoạn hiện tại" id="detail-stage-detail" value={t("detail-stage-detail")} />
        <MetaRow label="Thời gian hoàn tất" id="detail-finished-at" value={t("detail-finished-at")} />
      </div>
    </section>
  );
}
